/**
 * Price chart route.
 *
 * GET /api/tokens/:mint/chart?range=1h|4h|1d|all
 *
 * Aggregates trade data into OHLCV-style buckets from the trades table.
 * The latest (current) bucket is always overwritten with the live spot price
 * computed from the exponential bonding curve — so the chart reflects real
 * price movement even when there is only a single historical trade.
 */
import { FastifyInstance } from 'fastify';
export declare function chartRoutes(app: FastifyInstance): Promise<void>;
//# sourceMappingURL=chart.d.ts.map