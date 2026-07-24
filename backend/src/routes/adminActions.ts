import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { hashAdminPassword, requireAdmin, writeAdminAudit } from '../lib/adminAuth';
import { BSC_CHAIN_ID } from '../services/bsc';

const ReasonBody = z.object({ reason: z.string().trim().min(3).max(500).optional() });
const UserStatusBody = ReasonBody.extend({ status: z.enum(['active', 'suspended']) });
const AdminCreateBody = z.object({ email: z.string().email(), password: z.string().min(12).max(200), displayName: z.string().trim().min(2).max(80), role: z.enum(['super_admin', 'finance_admin', 'token_admin', 'moderation_admin', 'support_admin', 'viewer']) });
const AdminUpdateBody = z.object({ displayName: z.string().trim().min(2).max(80).optional(), role: z.enum(['super_admin', 'finance_admin', 'token_admin', 'moderation_admin', 'support_admin', 'viewer']).optional(), status: z.enum(['active', 'suspended']).optional(), password: z.string().min(12).max(200).optional() });
const WithdrawalBody = z.object({ status: z.enum(['processing', 'completed', 'failed']), txHash: z.string().trim().max(200).optional(), reason: z.string().trim().min(3).max(500).optional() });
const TokenBody = ReasonBody.extend({ status: z.enum(['active', 'cancelled']) });

export async function adminActionRoutes(app: FastifyInstance) {
  app.patch('/api/admin/users/:id/status', async (request, reply) => {
    const admin = await requireAdmin(request, ['support_admin']);
    if (!admin) return reply.code(403).send({ error: 'Forbidden' });
    const parsed = UserStatusBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid status' });
    const id = (request.params as { id: string }).id;
    const user = await prisma.user.update({ where: { id }, data: { status: parsed.data.status } });
    await writeAdminAudit({ adminUserId: admin.id, action: `user.${parsed.data.status}`, targetType: 'user', targetId: id, reason: parsed.data.reason, ipAddress: request.ip });
    return reply.send({ user: { id: user.id, status: user.status } });
  });

  app.patch('/api/admin/tokens/:mint/status', async (request, reply) => {
    const admin = await requireAdmin(request, ['token_admin']);
    if (!admin) return reply.code(403).send({ error: 'Forbidden' });
    const parsed = TokenBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid token status' });
    const mint = (request.params as { mint: string }).mint;
    const token = await prisma.token.update({ where: { mint }, data: { status: parsed.data.status } });
    await writeAdminAudit({ adminUserId: admin.id, action: `token.${parsed.data.status}`, targetType: 'token', targetId: mint, reason: parsed.data.reason, ipAddress: request.ip });
    return reply.send({ token: { mint: token.mint, status: token.status } });
  });

  app.delete('/api/admin/comments/:id', async (request, reply) => {
    const admin = await requireAdmin(request, ['moderation_admin']);
    if (!admin) return reply.code(403).send({ error: 'Forbidden' });
    const parsed = ReasonBody.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid moderation reason' });
    const id = (request.params as { id: string }).id;
    const comment = await prisma.comment.delete({ where: { id } });
    await writeAdminAudit({ adminUserId: admin.id, action: 'comment.remove', targetType: 'comment', targetId: id, reason: parsed.data.reason, metadata: { tokenMint: comment.tokenMint }, ipAddress: request.ip });
    return reply.send({ success: true, id });
  });

  app.patch('/api/admin/finance/withdrawals/:id', async (request, reply) => {
    const admin = await requireAdmin(request, ['finance_admin']);
    if (!admin) return reply.code(403).send({ error: 'Forbidden' });
    const parsed = WithdrawalBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid withdrawal update' });
    const id = (request.params as { id: string }).id;
    const result = await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawalRequest.findUnique({ where: { id } });
      if (!withdrawal) throw Object.assign(new Error('Withdrawal not found'), { statusCode: 404 });
      if (parsed.data.status === 'processing' && withdrawal.status !== 'pending') throw Object.assign(new Error('Only pending withdrawals can enter processing'), { statusCode: 409 });
      if (parsed.data.status === 'completed' && (!parsed.data.txHash || withdrawal.status !== 'processing')) throw Object.assign(new Error('A processing withdrawal and transaction hash are required'), { statusCode: 409 });
      if (parsed.data.status === 'failed' && ['completed', 'failed'].includes(withdrawal.status)) throw Object.assign(new Error('Withdrawal is already finalized'), { statusCode: 409 });
      const next = await tx.withdrawalRequest.update({ where: { id }, data: { status: parsed.data.status, txHash: parsed.data.txHash ?? withdrawal.txHash, error: parsed.data.status === 'failed' ? parsed.data.reason ?? 'Rejected by finance administrator' : null, refundedAt: parsed.data.status === 'failed' && !withdrawal.refundedAt ? new Date() : withdrawal.refundedAt } });
      if (parsed.data.status === 'failed' && !withdrawal.refundedAt) {
        await tx.userBalance.upsert({ where: { walletAddress_chainId_asset: { walletAddress: withdrawal.userWallet, chainId: BSC_CHAIN_ID, asset: withdrawal.asset } }, update: { available: { increment: withdrawal.amount } }, create: { userId: withdrawal.userId, walletAddress: withdrawal.userWallet, chainId: BSC_CHAIN_ID, asset: withdrawal.asset, available: withdrawal.amount } });
      }
      return next;
    }).catch((error: any) => { if (error?.statusCode) throw error; throw error; });
    await writeAdminAudit({ adminUserId: admin.id, action: `withdrawal.${parsed.data.status}`, targetType: 'withdrawal', targetId: id, reason: parsed.data.reason, metadata: { txHash: parsed.data.txHash ?? null }, ipAddress: request.ip });
    return reply.send({ withdrawal: { id: result.id, status: result.status, txHash: result.txHash, refundedAt: result.refundedAt } });
  });

  app.get('/api/admin/admin-users', async (request, reply) => {
    const admin = await requireAdmin(request, ['super_admin']);
    if (!admin) return reply.code(403).send({ error: 'Forbidden' });
    const admins = await prisma.adminUser.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, email: true, displayName: true, role: true, status: true, lastLoginAt: true, createdAt: true } });
    return reply.send({ admins });
  });

  app.post('/api/admin/admin-users', async (request, reply) => {
    const admin = await requireAdmin(request, ['super_admin']);
    if (!admin) return reply.code(403).send({ error: 'Forbidden' });
    const parsed = AdminCreateBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid admin account' });
    try {
      const created = await prisma.adminUser.create({ data: { email: parsed.data.email.toLowerCase(), passwordHash: hashAdminPassword(parsed.data.password), displayName: parsed.data.displayName, role: parsed.data.role } });
      await writeAdminAudit({ adminUserId: admin.id, action: 'admin.create', targetType: 'admin_user', targetId: created.id, metadata: { role: created.role }, ipAddress: request.ip });
      return reply.code(201).send({ admin: { id: created.id, email: created.email, displayName: created.displayName, role: created.role, status: created.status } });
    } catch (error: any) { if (error?.code === 'P2002') return reply.code(409).send({ error: 'Admin email already exists' }); throw error; }
  });

  app.patch('/api/admin/admin-users/:id', async (request, reply) => {
    const admin = await requireAdmin(request, ['super_admin']);
    if (!admin) return reply.code(403).send({ error: 'Forbidden' });
    const id = (request.params as { id: string }).id;
    const parsed = AdminUpdateBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid admin update' });
    if (id === admin.id && parsed.data.status === 'suspended') return reply.code(400).send({ error: 'You cannot suspend your own account' });
    if (parsed.data.status === 'suspended' && (await prisma.adminUser.count({ where: { role: 'super_admin', status: 'active', id: { not: id } } })) === 0 && parsed.data.role !== 'super_admin') return reply.code(409).send({ error: 'At least one active super administrator is required' });
    const updated = await prisma.adminUser.update({ where: { id }, data: { displayName: parsed.data.displayName, role: parsed.data.role, status: parsed.data.status, ...(parsed.data.password ? { passwordHash: hashAdminPassword(parsed.data.password) } : {}) } });
    if (parsed.data.status === 'suspended') await prisma.adminSession.updateMany({ where: { adminUserId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAdminAudit({ adminUserId: admin.id, action: 'admin.update', targetType: 'admin_user', targetId: id, metadata: { role: updated.role, status: updated.status }, ipAddress: request.ip });
    return reply.send({ admin: { id: updated.id, email: updated.email, displayName: updated.displayName, role: updated.role, status: updated.status } });
  });
}
