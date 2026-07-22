import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticateRequest } from '../lib/jwt';

const TargetType = z.enum(['comment', 'token', 'profile']);
const Reason = z.enum([
  'spam',
  'scam',
  'harassment',
  'hate_or_abuse',
  'fraud_or_impersonation',
  'offensive_content',
  'market_manipulation',
  'inappropriate_content',
  'duplicate',
  'other',
]);

const CreateReportBody = z.object({
  reporterWallet: z.string().min(32).max(44),
  targetType: TargetType,
  targetId: z.string().min(1).max(100),
  reason: Reason,
  details: z.string().trim().max(500).optional(),
});

const AdminStatusBody = z.object({
  status: z.enum(['open', 'reviewing', 'resolved', 'dismissed']),
  resolution: z.string().trim().max(500).optional(),
});

const reasonMap: Record<z.infer<typeof TargetType>, Set<string>> = {
  comment: new Set(['spam', 'scam', 'harassment', 'hate_or_abuse', 'fraud_or_impersonation', 'offensive_content', 'other']),
  token: new Set(['spam', 'scam', 'fraud_or_impersonation', 'market_manipulation', 'inappropriate_content', 'duplicate', 'other']),
  profile: new Set(['spam', 'scam', 'harassment', 'hate_or_abuse', 'fraud_or_impersonation', 'inappropriate_content', 'other']),
};

function adminAuthorized(request: { headers: { [key: string]: string | string[] | undefined } }) {
  const configured = process.env.ADMIN_SECRET;
  const provided = request.headers['x-admin-secret'];
  return Boolean(configured && typeof provided === 'string' && provided === configured);
}

async function targetExists(targetType: z.infer<typeof TargetType>, targetId: string) {
  if (targetType === 'comment') return Boolean(await prisma.comment.findUnique({ where: { id: targetId }, select: { id: true } }));
  if (targetType === 'token') return Boolean(await prisma.token.findUnique({ where: { mint: targetId }, select: { mint: true } }));
  return Boolean(await prisma.profile.findFirst({ where: { walletAddress: targetId.toLowerCase(), onboarded: true }, select: { walletAddress: true } }));
}

function priority(count: number) {
  if (count >= 100) return 'critical';
  if (count >= 50) return 'high';
  if (count >= 10) return 'review';
  if (count > 0) return 'low';
  return 'normal';
}

export async function reportRoutes(app: FastifyInstance) {
  app.post('/api/reports', {
    config: { rateLimit: { max: 20, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const parsed = CreateReportBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid report', code: 'INVALID_REPORT' });

    const reporterWallet = parsed.data.reporterWallet.toLowerCase();
    const authenticatedWallet = authenticateRequest(request.headers.authorization);
    if (!authenticatedWallet || authenticatedWallet.toLowerCase() !== reporterWallet) {
      return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    if (!reasonMap[parsed.data.targetType].has(parsed.data.reason)) {
      return reply.code(400).send({ error: 'That reason is not valid for this report type', code: 'INVALID_REASON' });
    }

    const targetId = parsed.data.targetType === 'profile' ? parsed.data.targetId.toLowerCase() : parsed.data.targetId;
    if (!(await targetExists(parsed.data.targetType, targetId))) {
      return reply.code(404).send({ error: 'Report target not found', code: 'TARGET_NOT_FOUND' });
    }

    try {
      const report = await prisma.report.create({
        data: {
          reporterWallet,
          targetType: parsed.data.targetType,
          targetId,
          reason: parsed.data.reason,
          details: parsed.data.details || null,
        },
      });
      const reportCount = await prisma.report.count({ where: { targetType: report.targetType, targetId: report.targetId } });
      return reply.code(201).send({ reportId: report.id, reportCount, priority: priority(reportCount) });
    } catch (error: any) {
      if (error?.code === 'P2002') return reply.code(409).send({ error: 'You already reported this item', code: 'DUPLICATE_REPORT' });
      throw error;
    }
  });

  app.get('/api/admin/reports', async (request, reply) => {
    if (!adminAuthorized(request)) return reply.code(403).send({ error: 'Forbidden' });
    const query = request.query as { status?: string; targetType?: string; limit?: string; offset?: string };
    const limit = Math.min(Math.max(Number(query.limit ?? 50) || 50, 1), 100);
    const offset = Math.max(Number(query.offset ?? 0) || 0, 0);
    const reports = await prisma.report.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.targetType ? { targetType: query.targetType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    const groupedRows = await prisma.report.groupBy({
      by: ['targetType', 'targetId'],
      _count: { _all: true },
      where: {
        ...(query.targetType ? { targetType: query.targetType } : {}),
      },
    });
    const grouped = new Map(groupedRows.map((row) => [`${row.targetType}:${row.targetId}`, row._count._all]));
    return reply.send({
      reports: reports.map((report) => {
        const count = grouped.get(`${report.targetType}:${report.targetId}`) ?? 1;
        return { ...report, reportCount: count, priority: priority(count) };
      }),
    });
  });

  app.patch('/api/admin/reports/:id', async (request, reply) => {
    if (!adminAuthorized(request)) return reply.code(403).send({ error: 'Forbidden' });
    const parsed = AdminStatusBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid moderation update', code: 'INVALID_UPDATE' });
    const report = await prisma.report.update({
      where: { id: (request.params as { id: string }).id },
      data: { status: parsed.data.status, resolution: parsed.data.resolution || null, reviewedBy: 'admin', reviewedAt: new Date() },
    });
    return reply.send({ report });
  });
}
