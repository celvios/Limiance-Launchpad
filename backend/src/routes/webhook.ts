/**
 * Helius webhook receiver.
 *
 * POST /webhook/helius
 *
 * Helius calls this endpoint whenever a transaction involving the launchpad
 * program is confirmed on-chain. We parse the program event logs, write
 * trades to the DB, update token supply, and broadcast to WebSocket clients.
 *
 * Auth: HMAC-SHA256 signature in `helius-webhook-secret` header.
 * Rate limit: not applied here (Helius IPs only — add IP allowlist in prod).
 */
import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { prisma } from '../services/prisma';
import { broadcast } from '../ws/server';

const WHALE_THRESHOLD = BigInt(
  Math.floor(parseFloat(process.env.WHALE_THRESHOLD_SOL ?? '10') * 1_000_000_000)
);
const WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET ?? '';
const PROGRAM_ID = process.env.PROGRAM_ID ?? '';

// ─────────────────────────────────────────────────────────────────────────────
// Helius event shape (simplified — full type from Helius SDK)
// ─────────────────────────────────────────────────────────────────────────────

interface HeliusEvent {
  signature: string;
  timestamp: number;       // unix seconds
  instructions?: Array<{
    programId: string;
    logs?: string[];
  }>;
  events?: {
    programData?: Array<{
      data: string;       // base58-encoded event data
      name: string;       // event discriminator name
    }>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Log parser — reads msg!() output from on-chain instructions
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedTrade {
  type: 'buy' | 'sell';
  mint: string;
  wallet: string;
  amount: bigint;
  solAmount: bigint;
  pricePerToken: bigint;
  supplyAfter: bigint;
  priceAfter: bigint;
}

interface ParsedGraduation {
  type: 'graduation';
  mint: string;
  raydiumPool: string;
  totalSol: bigint;
}

type ParsedEvent = ParsedTrade | ParsedGraduation | null;

/**
 * Parse program msg!() logs from a Helius event.
 * Log format examples:
 *   "buy: mint=<pk> buyer=<pk> amount=<n> cost=<n> fee=<n> supply=<n>"
 *   "sell: mint=<pk> seller=<pk> amount=<n> return=<n> supply=<n>"
 *   "graduated: mint=<pk> pool=<pk> vault_sol=<n> fee=<n>"
 */
function parseEventLogs(event: HeliusEvent): ParsedEvent {
  const logs: string[] = [];

  if (event.instructions) {
    for (const ix of event.instructions) {
      if (ix.programId === PROGRAM_ID && ix.logs) {
        logs.push(...ix.logs);
      }
    }
  }

  for (const log of logs) {
    // Buy
    const buyMatch = log.match(
      /^buy: mint=(\S+) buyer=(\S+) amount=(\d+) cost=(\d+) fee=(\d+) supply=(\d+)/
    );
    if (buyMatch) {
      const [, mint, buyer, amount, cost, , supply] = buyMatch;
      // price_after comes from BuyEvent — parse from a subsequent log if present
      const priceLog = logs.find((l) => l.startsWith('price_after='));
      const priceAfter = priceLog ? BigInt(priceLog.split('=')[1]) : 0n;
      return {
        type: 'buy',
        mint,
        wallet: buyer,
        amount: BigInt(amount),
        solAmount: BigInt(cost),
        pricePerToken: BigInt(amount) > 0n ? BigInt(cost) / BigInt(amount) : 0n,
        supplyAfter: BigInt(supply),
        priceAfter,
      };
    }

    // Sell
    const sellMatch = log.match(
      /^sell: mint=(\S+) seller=(\S+) amount=(\d+) return=(\d+) supply=(\d+)/
    );
    if (sellMatch) {
      const [, mint, seller, amount, ret, supply] = sellMatch;
      return {
        type: 'sell',
        mint,
        wallet: seller,
        amount: BigInt(amount),
        solAmount: BigInt(ret),
        pricePerToken: BigInt(amount) > 0n ? BigInt(ret) / BigInt(amount) : 0n,
        supplyAfter: BigInt(supply),
        priceAfter: 0n,
      };
    }

    // Graduation
    const gradMatch = log.match(
      /^graduated: mint=(\S+) pool=(\S+) vault_sol=(\d+)/
    );
    if (gradMatch) {
      const [, mint, pool, vaultSol] = gradMatch;
      return {
        type: 'graduation',
        mint,
        raydiumPool: pool,
        totalSol: BigInt(vaultSol),
      };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HMAC verification
// ─────────────────────────────────────────────────────────────────────────────

function verifyHeliusSignature(
  headerSecret: string | undefined,
  rawBody: Buffer
): boolean {
  if (!WEBHOOK_SECRET) return true; // dev mode: skip verification
  if (!headerSecret) return false;
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(headerSecret));
}

// ─────────────────────────────────────────────────────────────────────────────
// Route registration
// ─────────────────────────────────────────────────────────────────────────────

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/webhook/helius', {
    config: { rateLimit: { max: 1000, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const headerSecret = request.headers['helius-webhook-secret'] as string | undefined;
    const rawBody = Buffer.from(JSON.stringify(request.body));

    if (!verifyHeliusSignature(headerSecret, rawBody)) {
      return reply.code(401).send({ error: 'Invalid webhook signature' });
    }

    const events = request.body as HeliusEvent[];
    if (!Array.isArray(events)) {
      return reply.code(400).send({ error: 'Expected array of events' });
    }

    for (const event of events) {
      try {
        const parsed = parseEventLogs(event);
        if (!parsed) continue;

        if (parsed.type === 'buy' || parsed.type === 'sell') {
          const trade = parsed as ParsedTrade;

          // Fetch symbol for WS broadcast (best-effort, skip if DB miss)
          const tokenRecord = await prisma.token.findUnique({
            where: { mint: trade.mint },
            select: { symbol: true, name: true },
          });

          // Write trade to DB
          await prisma.trade.create({
            data: {
              tokenMint: trade.mint,
              walletAddress: trade.wallet,
              type: trade.type,
              amount: trade.amount,
              solAmount: trade.solAmount,
              pricePerToken: trade.pricePerToken,
              txSignature: event.signature,
              timestamp: new Date(event.timestamp * 1000),
              isWhale: trade.solAmount >= WHALE_THRESHOLD,
            },
          });

          // Update token supply in DB
          await prisma.token.update({
            where: { mint: trade.mint },
            data: { currentSupply: trade.supplyAfter },
          });

          // Broadcast trade event to WebSocket clients
          broadcast({
            type: trade.type,
            tokenMint: trade.mint,
            tokenSymbol: tokenRecord?.symbol ?? '',
            tokenName: tokenRecord?.name ?? '',
            walletAddress: trade.wallet,
            amount: trade.amount.toString(),
            solAmount: trade.solAmount.toString(),
            pricePerToken: trade.pricePerToken.toString(),
            txSignature: event.signature,
            timestamp: event.timestamp,
            isWhale: trade.solAmount >= WHALE_THRESHOLD,
          });

          app.log.info(
            `webhook: ${trade.type} mint=${trade.mint} wallet=${trade.wallet} amount=${trade.amount}`
          );
        } else if (parsed.type === 'graduation') {
          const grad = parsed as ParsedGraduation;

          // Fetch symbol for WS broadcast
          const tokenRecord = await prisma.token.findUnique({
            where: { mint: grad.mint },
            select: { symbol: true },
          });

          await prisma.token.update({
            where: { mint: grad.mint },
            data: {
              status: 'graduated',
              raydiumPoolId: grad.raydiumPool === '11111111111111111111111111111111'
                ? null  // default pubkey means test mode — no real pool
                : grad.raydiumPool,
            },
          });

          // Fetch final price from last trade for broadcast
          const lastTrade = await prisma.trade.findFirst({
            where: { tokenMint: grad.mint },
            orderBy: { timestamp: 'desc' },
            select: { pricePerToken: true },
          });

          broadcast({
            type: 'graduation',
            tokenMint: grad.mint,
            tokenSymbol: tokenRecord?.symbol ?? '',
            raydiumPoolId: grad.raydiumPool,
            finalPrice: lastTrade?.pricePerToken.toString() ?? '0',
            totalRaised: grad.totalSol.toString(),
            timestamp: event.timestamp,
          });

          app.log.info(
            `webhook: graduation mint=${grad.mint} pool=${grad.raydiumPool}`
          );
        }
      } catch (err) {
        app.log.error({ err, sig: event.signature }, 'webhook: failed to process event');
        // Don't throw — process remaining events
      }
    }

    return reply.send({ ok: true });
  });
}
