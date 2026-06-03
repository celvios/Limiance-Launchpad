/**
 * Auth routes — EVM signed-message session system.
 *
 * POST /api/auth/login   — verify wallet signature, issue JWT
 * POST /api/auth/logout  — stateless; client drops the token
 * GET  /api/auth/me      — validate a token, return wallet address
 */
import { FastifyInstance } from 'fastify';
export declare function buildLoginMessage(timestamp: number): string;
export declare function authRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=auth.d.ts.map