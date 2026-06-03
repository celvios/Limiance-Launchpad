/**
 * Comment routes — Phase 5 social layer.
 *
 * GET  /api/tokens/:mint/comments        — list (sorted by new or top)
 * POST /api/tokens/:mint/comments        — post a comment (wallet-signed)
 * POST /api/comments/:id/upvote          — toggle upvote (wallet-signed)
 */
import { FastifyInstance } from 'fastify';
export declare function commentRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=comments.d.ts.map