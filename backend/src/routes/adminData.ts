import { FastifyInstance } from 'fastify';
import { prisma } from '../services/prisma';
import { requireAdmin, writeAdminAudit } from '../lib/adminAuth';

function page(query: unknown) {
  const values = query as { limit?: string; offset?: string };
  return {
    limit: Math.min(Math.max(Number(values.limit ?? 50) || 50, 1), 100),
    offset: Math.max(Number(values.offset ?? 0) || 0, 0),
  };
}

function serializeBigInt<T extends Record<string, unknown>>(row: T) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? value.toString() : value]));
}

export async function adminDataRoutes(app: FastifyInstance) {
  app.get('/api/admin/dashboard', async (request, reply) => {
    const admin = await requireAdmin(request, ['support_admin', 'token_admin', 'finance_admin', 'viewer']);
    if (!admin) return reply.code(403).send({ error: 'Forbidden' });
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [users, profiles, tokens, trades24h, comments, openReports, pendingWithdrawals, indexer] = await Promise.all([
      prisma.user.count(),
      prisma.profile.count({ where: { onboarded: true } }),
      prisma.token.count(),
      prisma.trade.count({ where: { timestamp: { gte: since } } }),
      prisma.comment.count(),
      prisma.report.count({ where: { status: { in: ['open', 'reviewing'] } } }),
      prisma.withdrawalRequest.count({ where: { status: 'pending' } }),
      prisma.indexerState.findUnique({ where: { id: 'deposit_indexer' } }),
    ]);
    const balanceAggregate = await prisma.userBalance.aggregate({ _sum: { available: true } });
    return reply.send({
      counts: { users, profiles, tokens, trades24h, comments, openReports, pendingWithdrawals },
      liabilities: { availableUsdtRaw: (balanceAggregate._sum.available ?? 0n).toString() },
      health: { indexerLastProcessedBlock: indexer?.lastBlockProcessed?.toString() ?? null, checkedAt: Date.now() },
    });
  });

  app.get('/api/admin/users', async (request, reply) => {
    const admin = await requireAdmin(request, ['support_admin', 'finance_admin', 'viewer']);
    if (!admin) return reply.code(403).send({ error: 'Forbidden' });
    const query = request.query as { search?: string };
    const { limit, offset } = page(request.query);
    const search = query.search?.trim().toLowerCase();
    const users = await prisma.user.findMany({
      where: search ? { OR: [{ email: { contains: search } }, { primaryWalletAddress: { contains: search } }] } : undefined,
      orderBy: { createdAt: 'desc' }, take: limit, skip: offset,
      select: { id: true, email: true, primaryWalletAddress: true, authType: true, createdAt: true, updatedAt: true },
    });
    const wallets = users.flatMap((user) => user.primaryWalletAddress ? [user.primaryWalletAddress] : []);
    const [profiles, balances] = await Promise.all([
      prisma.profile.findMany({ where: { walletAddress: { in: wallets } }, select: { walletAddress: true, usernameDisplay: true, username: true, onboarded: true } }),
      prisma.userBalance.findMany({ where: { walletAddress: { in: wallets } }, select: { walletAddress: true, asset: true, available: true } }),
    ]);
    const profileMap = new Map(profiles.map((profile) => [profile.walletAddress, profile]));
    return reply.send({ users: users.map((user) => ({ ...user, profile: user.primaryWalletAddress ? profileMap.get(user.primaryWalletAddress) ?? null : null, balances: user.primaryWalletAddress ? balances.filter((balance) => balance.walletAddress === user.primaryWalletAddress).map(serializeBigInt) : [] })) });
  });

  app.get('/api/admin/users/:wallet', async (request, reply) => {
    const admin = await requireAdmin(request, ['support_admin', 'finance_admin']);
    if (!admin) return reply.code(403).send({ error: 'Forbidden' });
    const wallet = (request.params as { wallet: string }).wallet.toLowerCase();
    const [user, profile, balances, deposits, withdrawals, trades, reports] = await Promise.all([
      prisma.user.findFirst({ where: { primaryWalletAddress: wallet } }),
      prisma.profile.findFirst({ where: { walletAddress: wallet } }),
      prisma.userBalance.findMany({ where: { walletAddress: wallet } }),
      prisma.deposit.findMany({ where: { userWallet: wallet }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.withdrawalRequest.findMany({ where: { userWallet: wallet }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.trade.findMany({ where: { walletAddress: wallet }, orderBy: { timestamp: 'desc' }, take: 50 }),
      prisma.report.findMany({ where: { reporterWallet: wallet }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    if (!user && !profile && balances.length === 0) return reply.code(404).send({ error: 'User not found' });
    return reply.send({ user, profile, balances: balances.map(serializeBigInt), deposits: deposits.map(serializeBigInt), withdrawals: withdrawals.map(serializeBigInt), trades: trades.map(serializeBigInt), reports });
  });

  app.get('/api/admin/tokens', async (request, reply) => {
    const admin = await requireAdmin(request, ['token_admin', 'support_admin', 'viewer']);
    if (!admin) return reply.code(403).send({ error: 'Forbidden' });
    const query = request.query as { search?: string; status?: string };
    const { limit, offset } = page(request.query);
    const search = query.search?.trim();
    const tokens = await prisma.token.findMany({
      where: { ...(query.status ? { status: query.status } : {}), ...(search ? { OR: [{ symbol: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }, { mint: { contains: search, mode: 'insensitive' } }] } : {}) },
      orderBy: { createdAt: 'desc' }, take: limit, skip: offset,
      select: { mint: true, symbol: true, name: true, creator: true, status: true, currentSupply: true, supplyCap: true, graduationThreshold: true, createdAt: true },
    });
    return reply.send({ tokens: tokens.map(serializeBigInt) });
  });

  app.get('/api/admin/finance/withdrawals', async (request, reply) => {
    const admin = await requireAdmin(request, ['finance_admin', 'support_admin', 'viewer']);
    if (!admin) return reply.code(403).send({ error: 'Forbidden' });
    const query = request.query as { status?: string };
    const { limit, offset } = page(request.query);
    const withdrawals = await prisma.withdrawalRequest.findMany({ where: query.status ? { status: query.status } : undefined, orderBy: { createdAt: 'desc' }, take: limit, skip: offset });
    return reply.send({ withdrawals: withdrawals.map(serializeBigInt) });
  });

  app.get('/api/admin/audit-logs', async (request, reply) => {
    const admin = await requireAdmin(request, ['super_admin', 'support_admin', 'viewer']);
    if (!admin) return reply.code(403).send({ error: 'Forbidden' });
    const { limit, offset } = page(request.query);
    const logs = await prisma.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit, skip: offset, include: { adminUser: { select: { email: true, displayName: true, role: true } } } });
    return reply.send({ logs });
  });

  app.post('/api/admin/users/:wallet/suspend', async (request, reply) => {
    const admin = await requireAdmin(request, ['super_admin', 'support_admin']);
    if (!admin) return reply.code(403).send({ error: 'Forbidden' });
    const wallet = (request.params as { wallet: string }).wallet.toLowerCase();
    await writeAdminAudit({ adminUserId: admin.id, action: 'user.suspend', targetType: 'wallet', targetId: wallet, reason: 'Administrative suspension', ipAddress: request.ip });
    return reply.send({ success: true, wallet, status: 'suspended_pending_policy' });
  });
}
