"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityRoutes = activityRoutes;
const zod_1 = require("zod");
const prisma_1 = require("../services/prisma");
const ActivityQuery = zod_1.z.object({
    limit: zod_1.z.coerce.number().min(1).max(100).default(20),
    cursor: zod_1.z.string().optional(), // trade ID cursor
});
async function activityRoutes(app) {
    /**
     * GET /api/tokens/:mint/activity
     *
     * Response:
     *   { trades: TradeEvent[], nextCursor: string | null }
     */
    app.get('/api/tokens/:mint/activity', {
        config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    }, async (request, reply) => {
        const { mint } = request.params;
        const query = ActivityQuery.safeParse(request.query);
        if (!query.success) {
            return reply.code(400).send({ error: 'Invalid query params', code: 'INVALID_PARAMS' });
        }
        const { limit, cursor } = query.data;
        // Fetch one extra to determine if there's a next page
        const trades = await prisma_1.prisma.trade.findMany({
            where: { tokenMint: mint },
            orderBy: { timestamp: 'desc' },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: {
                id: true,
                type: true,
                walletAddress: true,
                amount: true,
                solAmount: true,
                pricePerToken: true,
                txSignature: true,
                timestamp: true,
                isWhale: true,
            },
        });
        const hasMore = trades.length > limit;
        if (hasMore)
            trades.pop();
        // Enrich with profile handles (best-effort)
        const wallets = [...new Set(trades.map((t) => t.walletAddress))];
        const profiles = await prisma_1.prisma.profile.findMany({
            where: { walletAddress: { in: wallets } },
            select: { walletAddress: true, username: true },
        });
        const handleMap = new Map(profiles.map((p) => [p.walletAddress, p.username]));
        const result = trades.map((t) => ({
            id: t.id,
            type: t.type,
            walletAddress: t.walletAddress,
            walletHandle: handleMap.get(t.walletAddress) ?? null,
            tokenAmount: Number(t.amount) / 1e6,
            solAmount: Number(t.solAmount) / 1e6,
            pricePerToken: Number(t.pricePerToken) < 1e10 ? Number(t.pricePerToken) / 1e6 : Number(t.pricePerToken) / 1e18,
            txSignature: t.txSignature,
            timestamp: t.timestamp.getTime(),
            isWhale: t.isWhale,
        }));
        return reply.send({
            trades: result,
            nextCursor: hasMore ? trades[trades.length - 1].id : null,
        });
    });
}
//# sourceMappingURL=activity.js.map