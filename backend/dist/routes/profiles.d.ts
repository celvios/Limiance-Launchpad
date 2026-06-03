/**
 * Profile routes — Phase 5 social layer.
 *
 * GET  /api/profiles/check-username/:username  — availability check
 * GET  /api/profiles/:wallet                   — get profile (404 = not onboarded)
 * POST /api/profiles                           — create profile (onboarding)
 * PUT  /api/profiles/:wallet                   — update profile
 * GET  /api/profiles/:wallet/tokens            — tokens created by wallet
 * GET  /api/profiles/:wallet/holdings          — current token holdings
 * GET  /api/profiles/:wallet/trades            — trade history
 * GET  /api/profiles/:wallet/comments          — comments posted
 *
 * Auth: POST and PUT require a wallet signature.
 * GET endpoints are public (no auth required).
 */
import { FastifyInstance } from 'fastify';
export declare function profileRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=profiles.d.ts.map