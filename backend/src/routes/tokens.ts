import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { BSC_CHAIN_ID, normalizeAddress } from '../services/bsc';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const DeployBody = z.object({
  creator: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  name: z.string().min(1).max(32),
  symbol: z.string().min(1).max(10),
  description: z.string().max(500).default(''),
  imageUri: z.string().default(''),
  totalSupply: z.number().int().positive(),
  initialBuyAmount: z.number().min(0).default(0),
  graduationThreshold: z.number().min(40).max(100),
  curveParams: z.object({
    pMin: z.number().optional(),
    pMax: z.number().optional(),
    k: z.number().optional(),
    midpoint: z.number().optional(),
  }).passthrough(),
});

const FeedQuery = z.object({
  filter: z.enum(['new', 'trending', 'near_grad', 'graduated', 'following']).default('new'),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  wallet: z.string().optional(),
});

function pseudoAddress(seed: string): string {
  let hash = 0n;
  for (const char of seed) {
    hash = (hash * 33n + BigInt(char.charCodeAt(0))) & ((1n << 160n) - 1n);
  }
  return `0x${hash.toString(16).padStart(40, '0')}`;
}

function toWei(value: number): bigint {
  return BigInt(Math.round(value * 1e18));
}

function serializeToken(token: any) {
  const tokenAddress = token.tokenAddress ?? token.mint;
  const supply = Number(token.currentSupply.toString());
  const cap = Number(token.supplyCap.toString());
  const pMax = Number(token.curveParamA.toString()) / 1e18;
  const pMin = Number(token.curveParamB.toString()) / 1e18;
  const marketCap = cap > 0 ? pMax * supply : 0;

  return {
    tokenAddress,
    mint: tokenAddress,
    symbol: token.symbol,
    name: token.name,
    imageUri: token.uri,
    description: token.description,
    creatorWallet: token.creator,
    creatorHandle: null,
    createdAt: token.createdAt.getTime(),
    curveType: 'sigmoid',
    curveParams: {
      type: 'sigmoid',
      pMin,
      pMax,
      k: Number(token.curveParamC) / 1e6,
      midpoint: Number(token.graduationThreshold),
    },
    currentSupply: supply,
    supplyCap: cap,
    graduationThreshold: Number(token.graduationThreshold),
    status: token.status,
    price: pMax,
    priceChange24h: 0,
    marketCap,
    commentCount: 0,
    sparklineData: [],
    volume24h: 0,
    holderCount: 0,
    totalSupply: cap,
    basePrice: pMin,
    platformFee: 3,
    totalRaised: 0,
    dexPoolAddress: token.dexPoolAddress ?? null,
  };
}

export async function tokenRoutes(app: FastifyInstance) {
  app.post('/api/tokens/deploy', async (req, reply) => {
    const parsed = DeployBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
    }

    try {
      const body = parsed.data;
      const creator = normalizeAddress(body.creator);
      const tokenAddress = pseudoAddress(`${creator}:${body.symbol}:${Date.now()}`);
      const saleAddress = pseudoAddress(`${tokenAddress}:sale`);
      const supplyCap = BigInt(body.totalSupply);
      const graduationThreshold = (supplyCap * BigInt(body.graduationThreshold)) / 100n;

      const token = await prisma.token.create({
        data: {
          mint: tokenAddress,
          tokenAddress,
          saleAddress,
          chainId: BSC_CHAIN_ID,
          creator,
          name: body.name,
          symbol: body.symbol.toUpperCase(),
          uri: body.imageUri,
          description: body.description,
          supplyCap,
          currentSupply: BigInt(body.initialBuyAmount),
          graduationThreshold,
          creatorAllocation: 0,
          curveType: 'sigmoid',
          curveParamA: toWei(body.curveParams.pMax ?? 0.1),
          curveParamB: toWei(body.curveParams.pMin ?? 0.00001),
          curveParamC: BigInt(Math.round((body.curveParams.k ?? 0.002) * 1e6)),
          status: 'active',
        },
      });

      // Calculate costs and solAmount
      let initialSolAmountWei = 0n;
      let costUsdt = 0;
      if (body.initialBuyAmount > 0) {
        const priceUsdt = body.curveParams.pMin ?? 0.00001;
        costUsdt = body.initialBuyAmount * priceUsdt;
        initialSolAmountWei = BigInt(Math.floor(costUsdt * 1e6)); // 1e6 for solAmount
      }

      const creationFeeUsdt = 3.0; // Assume 3 USDT creation fee
      const totalCostUsdt = costUsdt + creationFeeUsdt;
      const totalCostWei = BigInt(Math.floor(totalCostUsdt * 1e6));

      // Charge the user
      await prisma.userBalance.upsert({
        where: {
          walletAddress_chainId_asset: {
            walletAddress: creator,
            chainId: 97, // Assuming BSC Testnet for simulation
            asset: '0x0000000000000000000000000000000000000000',
          },
        },
        update: {
          available: { decrement: totalCostWei },
          consumed: { increment: totalCostWei },
        },
        create: {
          walletAddress: creator,
          chainId: 97,
          asset: '0x0000000000000000000000000000000000000000',
          available: 10000_000000n - totalCostWei, // Give 10k mock USDT initially if no balance
          consumed: totalCostWei,
        },
      });

      if (body.initialBuyAmount > 0) {
        await prisma.trade.create({
          data: {
            tokenMint: tokenAddress,
            tokenAddress,
            walletAddress: creator,
            type: 'buy',
            amount: BigInt(body.initialBuyAmount),
            solAmount: initialSolAmountWei,
            paymentAmount: initialSolAmountWei,
            paymentAsset: '0x0000000000000000000000000000000000000000',
            pricePerToken: toWei(body.curveParams.pMin ?? 0.00001),
            txSignature: `initial-buy-${token.id}`,
            timestamp: new Date(),
            isWhale: false,
          },
        });
      }

      return reply.code(201).send({
        success: true,
        tokenAddress,
        saleAddress,
        mint: tokenAddress,
        txSignature: `pending:${token.id}`,
      });
    } catch (err) {
      console.error('[tokens/deploy] Error:', err);
      return reply.code(500).send({
        error: err instanceof Error ? err.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  });

  app.get('/api/tokens/check-name', async (req, reply) => {
    const { name } = req.query as { name?: string };
    const existing = name
      ? await prisma.token.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })
      : null;
    return reply.send({ available: !existing });
  });

  app.get('/api/tokens/check-symbol', async (req, reply) => {
    const { symbol } = req.query as { symbol?: string };
    const existing = symbol
      ? await prisma.token.findFirst({ where: { symbol: { equals: symbol, mode: 'insensitive' } } })
      : null;
    return reply.send({ available: !existing });
  });

  app.get('/api/tokens', async (req, reply) => {
    const parsed = FeedQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
    }

    const where: any = {};
    if (parsed.data.filter === 'graduated') where.status = 'graduated';
    else where.status = 'active';
    if (parsed.data.cursor) where.createdAt = { lt: new Date(parsed.data.cursor) };

    const tokens = await prisma.token.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parsed.data.limit + 1,
    });
    const page = tokens.slice(0, parsed.data.limit);
    const nextCursor = tokens.length > parsed.data.limit ? page[page.length - 1]?.createdAt.toISOString() : null;
    return reply.send({ tokens: page.map(serializeToken), nextCursor, total: page.length });
  });

  app.get('/api/tokens/:address', async (req, reply) => {
    const { address } = req.params as { address: string };
    const tokenAddress = address.toLowerCase();
    const token = await prisma.token.findFirst({
      where: { OR: [{ tokenAddress }, { mint: tokenAddress }] },
    });
    if (!token) return reply.code(404).send({ error: 'Token not found', code: 'NOT_FOUND' });
    return reply.send(serializeToken(token));
  });
}
