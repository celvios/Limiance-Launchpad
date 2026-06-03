/**
 * Follow and Watchlist routes — Phase 5 social layer.
 *
 * POST   /api/follows              — follow a wallet (wallet-signed)
 * DELETE /api/follows              — unfollow a wallet (wallet-signed)
 * GET    /api/watchlist/:wallet    — get watchlist
 * POST   /api/watchlist            — add to watchlist (wallet-signed)
 * DELETE /api/watchlist            — remove from watchlist (wallet-signed)
 */
import { FastifyInstance } from 'fastify';
export declare function followRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=follows.d.ts.map