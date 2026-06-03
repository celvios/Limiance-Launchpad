/**
 * Price chart route.
 *
 * GET /api/tokens/:mint/chart?range=1h|4h|1d|all
 *
 * Aggregates trade data into OHLCV-style buckets from the trades table.
 * Returns (time, price, volume) tuples sorted ascending for chart rendering.
 */
import { FastifyInstance } from 'fastify';
export declare function chartRoutes(app: FastifyInstance): Promise<void>;
//# sourceMappingURL=chart.d.ts.map