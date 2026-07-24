"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminActionRoutes = adminActionRoutes;
const zod_1 = require("zod");
const prisma_1 = require("../services/prisma");
const adminAuth_1 = require("../lib/adminAuth");
const bsc_1 = require("../services/bsc");
const ReasonBody = zod_1.z.object({ reason: zod_1.z.string().trim().min(3).max(500).optional() });
const UserStatusBody = ReasonBody.extend({ status: zod_1.z.enum(['active', 'suspended']) });
const AdminCreateBody = zod_1.z.object({ email: zod_1.z.string().email(), password: zod_1.z.string().min(12).max(200), displayName: zod_1.z.string().trim().min(2).max(80), role: zod_1.z.enum(['super_admin', 'finance_admin', 'token_admin', 'moderation_admin', 'support_admin', 'viewer']) });
const AdminUpdateBody = zod_1.z.object({ displayName: zod_1.z.string().trim().min(2).max(80).optional(), role: zod_1.z.enum(['super_admin', 'finance_admin', 'token_admin', 'moderation_admin', 'support_admin', 'viewer']).optional(), status: zod_1.z.enum(['active', 'suspended']).optional(), password: zod_1.z.string().min(12).max(200).optional() });
const WithdrawalBody = zod_1.z.object({ status: zod_1.z.enum(['processing', 'completed', 'failed']), txHash: zod_1.z.string().trim().max(200).optional(), reason: zod_1.z.string().trim().min(3).max(500).optional() });
const TokenBody = ReasonBody.extend({ status: zod_1.z.enum(['active', 'cancelled']) });
async function adminActionRoutes(app) {
    app.patch('/api/admin/users/:id/status', async (request, reply) => {
        const admin = await (0, adminAuth_1.requireAdmin)(request, ['support_admin']);
        if (!admin)
            return reply.code(403).send({ error: 'Forbidden' });
        const parsed = UserStatusBody.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid status' });
        const id = request.params.id;
        const user = await prisma_1.prisma.user.update({ where: { id }, data: { status: parsed.data.status } });
        await (0, adminAuth_1.writeAdminAudit)({ adminUserId: admin.id, action: `user.${parsed.data.status}`, targetType: 'user', targetId: id, reason: parsed.data.reason, ipAddress: request.ip });
        return reply.send({ user: { id: user.id, status: user.status } });
    });
    app.patch('/api/admin/tokens/:mint/status', async (request, reply) => {
        const admin = await (0, adminAuth_1.requireAdmin)(request, ['token_admin']);
        if (!admin)
            return reply.code(403).send({ error: 'Forbidden' });
        const parsed = TokenBody.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid token status' });
        const mint = request.params.mint;
        const token = await prisma_1.prisma.token.update({ where: { mint }, data: { status: parsed.data.status } });
        await (0, adminAuth_1.writeAdminAudit)({ adminUserId: admin.id, action: `token.${parsed.data.status}`, targetType: 'token', targetId: mint, reason: parsed.data.reason, ipAddress: request.ip });
        return reply.send({ token: { mint: token.mint, status: token.status } });
    });
    app.delete('/api/admin/comments/:id', async (request, reply) => {
        const admin = await (0, adminAuth_1.requireAdmin)(request, ['moderation_admin']);
        if (!admin)
            return reply.code(403).send({ error: 'Forbidden' });
        const parsed = ReasonBody.safeParse(request.body ?? {});
        if (!parsed.success)
            return reply.code(400).send({ error: 'Invalid moderation reason' });
        const id = request.params.id;
        const comment = await prisma_1.prisma.comment.delete({ where: { id } });
        await (0, adminAuth_1.writeAdminAudit)({ adminUserId: admin.id, action: 'comment.remove', targetType: 'comment', targetId: id, reason: parsed.data.reason, metadata: { tokenMint: comment.tokenMint }, ipAddress: request.ip });
        return reply.send({ success: true, id });
    });
    app.patch('/api/admin/finance/withdrawals/:id', async (request, reply) => {
        const admin = await (0, adminAuth_1.requireAdmin)(request, ['finance_admin']);
        if (!admin)
            return reply.code(403).send({ error: 'Forbidden' });
        const parsed = WithdrawalBody.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid withdrawal update' });
        const id = request.params.id;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const withdrawal = await tx.withdrawalRequest.findUnique({ where: { id } });
            if (!withdrawal)
                throw Object.assign(new Error('Withdrawal not found'), { statusCode: 404 });
            if (parsed.data.status === 'processing' && withdrawal.status !== 'pending')
                throw Object.assign(new Error('Only pending withdrawals can enter processing'), { statusCode: 409 });
            if (parsed.data.status === 'completed' && (!parsed.data.txHash || withdrawal.status !== 'processing'))
                throw Object.assign(new Error('A processing withdrawal and transaction hash are required'), { statusCode: 409 });
            if (parsed.data.status === 'failed' && ['completed', 'failed'].includes(withdrawal.status))
                throw Object.assign(new Error('Withdrawal is already finalized'), { statusCode: 409 });
            const next = await tx.withdrawalRequest.update({ where: { id }, data: { status: parsed.data.status, txHash: parsed.data.txHash ?? withdrawal.txHash, error: parsed.data.status === 'failed' ? parsed.data.reason ?? 'Rejected by finance administrator' : null, refundedAt: parsed.data.status === 'failed' && !withdrawal.refundedAt ? new Date() : withdrawal.refundedAt } });
            if (parsed.data.status === 'failed' && !withdrawal.refundedAt) {
                await tx.userBalance.upsert({ where: { walletAddress_chainId_asset: { walletAddress: withdrawal.userWallet, chainId: bsc_1.BSC_CHAIN_ID, asset: withdrawal.asset } }, update: { available: { increment: withdrawal.amount } }, create: { userId: withdrawal.userId, walletAddress: withdrawal.userWallet, chainId: bsc_1.BSC_CHAIN_ID, asset: withdrawal.asset, available: withdrawal.amount } });
            }
            return next;
        }).catch((error) => { if (error?.statusCode)
            throw error; throw error; });
        await (0, adminAuth_1.writeAdminAudit)({ adminUserId: admin.id, action: `withdrawal.${parsed.data.status}`, targetType: 'withdrawal', targetId: id, reason: parsed.data.reason, metadata: { txHash: parsed.data.txHash ?? null }, ipAddress: request.ip });
        return reply.send({ withdrawal: { id: result.id, status: result.status, txHash: result.txHash, refundedAt: result.refundedAt } });
    });
    app.get('/api/admin/admin-users', async (request, reply) => {
        const admin = await (0, adminAuth_1.requireAdmin)(request, ['super_admin']);
        if (!admin)
            return reply.code(403).send({ error: 'Forbidden' });
        const admins = await prisma_1.prisma.adminUser.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, email: true, displayName: true, role: true, status: true, lastLoginAt: true, createdAt: true } });
        return reply.send({ admins });
    });
    app.post('/api/admin/admin-users', async (request, reply) => {
        const admin = await (0, adminAuth_1.requireAdmin)(request, ['super_admin']);
        if (!admin)
            return reply.code(403).send({ error: 'Forbidden' });
        const parsed = AdminCreateBody.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid admin account' });
        try {
            const created = await prisma_1.prisma.adminUser.create({ data: { email: parsed.data.email.toLowerCase(), passwordHash: (0, adminAuth_1.hashAdminPassword)(parsed.data.password), displayName: parsed.data.displayName, role: parsed.data.role } });
            await (0, adminAuth_1.writeAdminAudit)({ adminUserId: admin.id, action: 'admin.create', targetType: 'admin_user', targetId: created.id, metadata: { role: created.role }, ipAddress: request.ip });
            return reply.code(201).send({ admin: { id: created.id, email: created.email, displayName: created.displayName, role: created.role, status: created.status } });
        }
        catch (error) {
            if (error?.code === 'P2002')
                return reply.code(409).send({ error: 'Admin email already exists' });
            throw error;
        }
    });
    app.patch('/api/admin/admin-users/:id', async (request, reply) => {
        const admin = await (0, adminAuth_1.requireAdmin)(request, ['super_admin']);
        if (!admin)
            return reply.code(403).send({ error: 'Forbidden' });
        const id = request.params.id;
        const parsed = AdminUpdateBody.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: 'Invalid admin update' });
        if (id === admin.id && parsed.data.status === 'suspended')
            return reply.code(400).send({ error: 'You cannot suspend your own account' });
        if (parsed.data.status === 'suspended' && (await prisma_1.prisma.adminUser.count({ where: { role: 'super_admin', status: 'active', id: { not: id } } })) === 0 && parsed.data.role !== 'super_admin')
            return reply.code(409).send({ error: 'At least one active super administrator is required' });
        const updated = await prisma_1.prisma.adminUser.update({ where: { id }, data: { displayName: parsed.data.displayName, role: parsed.data.role, status: parsed.data.status, ...(parsed.data.password ? { passwordHash: (0, adminAuth_1.hashAdminPassword)(parsed.data.password) } : {}) } });
        if (parsed.data.status === 'suspended')
            await prisma_1.prisma.adminSession.updateMany({ where: { adminUserId: id, revokedAt: null }, data: { revokedAt: new Date() } });
        await (0, adminAuth_1.writeAdminAudit)({ adminUserId: admin.id, action: 'admin.update', targetType: 'admin_user', targetId: id, metadata: { role: updated.role, status: updated.status }, ipAddress: request.ip });
        return reply.send({ admin: { id: updated.id, email: updated.email, displayName: updated.displayName, role: updated.role, status: updated.status } });
    });
}
//# sourceMappingURL=adminActions.js.map