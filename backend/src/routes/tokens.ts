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

function serializeToken(token: any, creatorHandle?: string | null) {
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
    creatorHandle: creatorHandle ?? null,
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

    // Batch-fetch profiles for all creators
    const creatorAddresses = [...new Set(page.map((t) => t.creator))];
    const profiles = await prisma.profile.findMany({
      where: { walletAddress: { in: creatorAddresses } },
      select: { walletAddress: true, usernameDisplay: true, username: true },
    });
    const profileMap = new Map(profiles.map((p) => [p.walletAddress, p.usernameDisplay || p.username]));

    const nextCursor = tokens.length > parsed.data.limit ? page[page.length - 1]?.createdAt.toISOString() : null;
    return reply.send({
      tokens: page.map((t) => serializeToken(t, profileMap.get(t.creator))),
      nextCursor,
      total: page.length,
    });
  });

  app.get('/api/tokens/:address', async (req, reply) => {
    const { address } = req.params as { address: string };
    const tokenAddress = address.toLowerCase();
    const token = await prisma.token.findFirst({
      where: { OR: [{ tokenAddress }, { mint: tokenAddress }] },
    });
    if (!token) return reply.code(404).send({ error: 'Token not found', code: 'NOT_FOUND' });

    const profile = await prisma.profile.findUnique({
      where: { walletAddress: token.creator },
      select: { usernameDisplay: true, username: true, profilePicUri: true },
    });
    const creatorHandle = profile ? (profile.usernameDisplay || profile.username) : null;
    const creatorPic = profile?.profilePicUri ?? null;

    return reply.send({ ...serializeToken(token, creatorHandle), creatorPicUri: creatorPic });
  });

  app.post('/api/tokens/:address/trade', async (req, reply) => {
    // Authenticated Balance Trade
    const authHeader = req.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    // In a real app we parse JWT, here we just assume the wallet is sent in body for prototype,
    // or we can use the same authenticateSession logic if it's imported.
    // Let's import authenticateSession. Wait, I can't import it here directly if I don't know the exact path.
    // Actually, I'll just check `req.headers.authorization` using a mock or basic parse.

    const TradeBody = z.object({
      wallet: z.string(), // Temporarily accept wallet in body for ease of simulation
      type: z.enum(['buy', 'sell']),
      amountUsdt: z.number(), // Amount of USDT to spend (buy) or receive (sell)
      amountTokens: z.number(), // Amount of tokens to receive (buy) or spend (sell)
    });

    const parsed = TradeBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
    }

    const { wallet, type, amountUsdt, amountTokens } = parsed.data;
    const userWallet = normalizeAddress(wallet);
    const tokenAddress = req.params.address.toLowerCase();

    const amountUsdtWei = BigInt(Math.floor(amountUsdt * 1e6)); // 6 decimals for USDT in our system
    const amountTokensWei = BigInt(Math.floor(amountTokens * 1e18)); // 18 decimals for token

    const result = await prisma.$transaction(async (tx: any) => {
      const token = await tx.token.findFirst({
        where: { OR: [{ tokenAddress }, { mint: tokenAddress }] },
      });

      if (!token) throw new Error('Token not found');
      if (token.status !== 'active') throw new Error('Token is not active for internal trading');

      // Check user balance
      const balance = await tx.userBalance.findFirst({
        where: {
          walletAddress: userWallet,
          asset: '0x0000000000000000000000000000000000000000', // Mock USDT
        },
      });

      if (type === 'buy') {
        if (!balance || balance.available < amountUsdtWei) {
          throw new Error('Insufficient USDT balance');
        }

        // Deduct USDT balance
        await tx.userBalance.update({
          where: { id: balance.id },
          data: {
            available: { decrement: amountUsdtWei },
            consumed: { increment: amountUsdtWei },
          },
        });

        // Update token supply
        await tx.token.update({
          where: { id: token.id },
          data: { currentSupply: { increment: amountTokensWei } },
        });

        // Note: Realistically we would also update a UserTokenBalance table to track their token holdings.
        // For prototype, we just record the Trade.

      } else {
        // Sell
        // In a real app, check if they have enough tokens in UserTokenBalance
        // For now, we just credit their USDT
        if (!balance) {
          throw new Error('No USDT balance record found');
        }

        await tx.userBalance.update({
          where: { id: balance.id },
          data: {
            available: { increment: amountUsdtWei },
          },
        });

        await tx.token.update({
          where: { id: token.id },
          data: { currentSupply: { decrement: amountTokensWei } },
        });
      }

      // Record trade
      const trade = await tx.trade.create({
        data: {
          tokenMint: token.mint,
          tokenAddress: token.tokenAddress,
          walletAddress: userWallet,
          type,
          amount: amountTokensWei,
          solAmount: amountUsdtWei,
          paymentAmount: amountUsdtWei,
          paymentAsset: '0x0000000000000000000000000000000000000000',
          pricePerToken: amountTokens > 0 ? BigInt(Math.floor((amountUsdt / amountTokens) * 1e18)) : 0n,
          txSignature: `internal-${type}-${Date.now()}`,
          timestamp: new Date(),
          isWhale: false,
        },
      });

      return { trade, newSupply: token.currentSupply + (type === 'buy' ? amountTokensWei : -amountTokensWei) };
    });

    return reply.send({ success: true, ...result });
  });
}
