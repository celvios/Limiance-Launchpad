import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { BSC_CHAIN_ID, normalizeAddress, TOKEN_CREATION_FEE_USDT, PAYMENT_ASSET } from '../services/bsc';

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

interface TokenSocialCounts {
  commentCount: number;
  holderCount: number;
  watchCount: number;
}

function emptyCounts(): TokenSocialCounts {
  return { commentCount: 0, holderCount: 0, watchCount: 0 };
}

async function fetchTokenSocialCounts(tokenMints: string[]): Promise<Map<string, TokenSocialCounts>> {
  const uniqueMints = [...new Set(tokenMints)].filter(Boolean);
  const countMap = new Map(uniqueMints.map((mint) => [mint, emptyCounts()]));
  if (uniqueMints.length === 0) return countMap;

  const [commentCounts, watchCounts, holderRows] = await Promise.all([
    prisma.comment.groupBy({
      by: ['tokenMint'],
      where: { tokenMint: { in: uniqueMints } },
      _count: { _all: true },
    }),
    prisma.watchlist.groupBy({
      by: ['tokenMint'],
      where: { tokenMint: { in: uniqueMints } },
      _count: { _all: true },
    }),
    prisma.trade.groupBy({
      by: ['tokenMint', 'walletAddress'],
      where: { tokenMint: { in: uniqueMints }, type: 'buy' },
    }),
  ]);

  for (const row of commentCounts) {
    countMap.set(row.tokenMint, {
      ...(countMap.get(row.tokenMint) ?? emptyCounts()),
      commentCount: row._count._all,
    });
  }

  for (const row of watchCounts) {
    countMap.set(row.tokenMint, {
      ...(countMap.get(row.tokenMint) ?? emptyCounts()),
      watchCount: row._count._all,
    });
  }

  for (const row of holderRows) {
    const current = countMap.get(row.tokenMint) ?? emptyCounts();
    countMap.set(row.tokenMint, { ...current, holderCount: current.holderCount + 1 });
  }

  return countMap;
}

function serializeToken(token: any, creatorHandle?: string | null, counts: TokenSocialCounts = emptyCounts()) {
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
    commentCount: counts.commentCount,
    watchCount: counts.watchCount,
    sparklineData: [],
    volume24h: 0,
    holderCount: counts.holderCount,
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

      const creationFeeUsdt = TOKEN_CREATION_FEE_USDT; // Read from RENDER env var
      const totalCostUsdt = costUsdt + creationFeeUsdt;
      const totalCostWei = BigInt(Math.floor(totalCostUsdt * 1e6));

      // Charge the user — check balance first
      const balance = await prisma.userBalance.findFirst({
        where: {
          walletAddress: creator,
          asset: PAYMENT_ASSET,
        },
      });
      if (!balance || balance.available < totalCostWei) {
        // Roll back token creation and return error
        await prisma.token.delete({ where: { id: token.id } });
        return reply.code(402).send({
          error: `Insufficient balance. Need ${totalCostUsdt.toFixed(2)} USDT (${creationFeeUsdt} fee + ${costUsdt.toFixed(2)} initial buy).`,
          code: 'INSUFFICIENT_BALANCE',
          required: totalCostWei.toString(),
          creationFee: BigInt(Math.floor(creationFeeUsdt * 1e6)).toString(),
        });
      }
      await prisma.userBalance.upsert({
        where: {
          walletAddress_chainId_asset: {
            walletAddress: creator,
            chainId: 97, // Assuming BSC Testnet for simulation
            asset: PAYMENT_ASSET,
          },
        },
        update: {
          available: { decrement: totalCostWei },
          consumed: { increment: totalCostWei },
        },
        create: {
          walletAddress: creator,
          chainId: 97,
          asset: PAYMENT_ASSET,
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
            paymentAsset: PAYMENT_ASSET,
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
    const countMap = await fetchTokenSocialCounts(page.map((t) => t.mint));

    return reply.send({
      tokens: page.map((t) => serializeToken(t, profileMap.get(t.creator), countMap.get(t.mint))),
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

    const countMap = await fetchTokenSocialCounts([token.mint]);

    return reply.send({ ...serializeToken(token, creatorHandle, countMap.get(token.mint)), creatorPicUri: creatorPic });
  });

  app.post('/api/tokens/:address/trade', async (req, reply) => {
    // Authenticated Balance Trade — fully backend-tracked (no on-chain tx per trade)
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const TradeBody = z.object({
      wallet: z.string(),
      type: z.enum(['buy', 'sell']),
      amountUsdt: z.number().positive(),   // USDT to spend (buy) or USDT to receive (sell)
      amountTokens: z.number().positive(), // Tokens to receive (buy) or tokens to sell (sell)
    });

    const parsed = TradeBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
    }

    const { wallet, type, amountUsdt, amountTokens } = parsed.data;
    const userWallet = normalizeAddress(wallet)!;
    const { address: tokenAddressParam } = req.params as { address: string };
    const tokenAddress = tokenAddressParam.toLowerCase();

    // USDT: 6 decimals for DB storage
    // Tokens: TWO representations needed:
    //   amountTokensRaw  = raw integer units (matches Token.currentSupply / graduationThreshold scale)
    //   amountTokensWei  = 6-decimal units for UserTokenBalance (fits in Postgres BIGINT)
    const amountUsdtWei    = BigInt(Math.round(amountUsdt   * 1e6));
    const amountTokensRaw  = BigInt(Math.round(amountTokens));        // for currentSupply
    const amountTokensWei  = BigInt(Math.round(amountTokens * 1e6));  // for UserTokenBalance

    try {
      const result = await prisma.$transaction(async (tx: any) => {
        const token = await tx.token.findFirst({
          where: { OR: [{ tokenAddress }, { mint: tokenAddress }] },
        });
        if (!token) throw new Error('Token not found');
        // Allow trading on 'active' and 'graduating' tokens (graduation is async)
        if (token.status !== 'active' && token.status !== 'graduating') {
          throw new Error(`Token is not available for trading (status: ${token.status})`);
        }

        const usdtBalance = await tx.userBalance.findFirst({
          where: { walletAddress: userWallet, asset: PAYMENT_ASSET },
        });

        if (type === 'buy') {
          // ── BUY ──────────────────────────────────────────────────────────────
          if (!usdtBalance || usdtBalance.available < amountUsdtWei) {
            throw new Error('Insufficient USDT balance — please deposit more');
          }

          // Deduct USDT
          await tx.userBalance.update({
            where: { id: usdtBalance.id },
            data: { available: { decrement: amountUsdtWei }, consumed: { increment: amountUsdtWei } },
          });

          // Credit token balance (6-decimal scaled for UserTokenBalance)
          const existingTokenBal = await tx.userTokenBalance.findUnique({
            where: { walletAddress_tokenAddress: { walletAddress: userWallet, tokenAddress: token.mint } },
          });

          if (existingTokenBal) {
            await tx.userTokenBalance.update({
              where: { id: existingTokenBal.id },
              data: { amount: { increment: amountTokensWei } },
            });
          } else {
            await tx.userTokenBalance.create({
              data: { walletAddress: userWallet, tokenAddress: token.mint, amount: amountTokensWei },
            });
          }

          // Advance the bonding curve supply (raw integer units — matches graduationThreshold scale)
          const newSupply = token.currentSupply + amountTokensRaw;
          const willGraduate = newSupply >= token.graduationThreshold;
          await tx.token.update({
            where: { id: token.id },
            data: {
              currentSupply: newSupply,
              status: willGraduate ? 'graduating' : 'active',
            },
          });

        } else {
          // ── SELL ─────────────────────────────────────────────────────────────
          const tokenBalance = await tx.userTokenBalance.findUnique({
            where: { walletAddress_tokenAddress: { walletAddress: userWallet, tokenAddress: token.mint } },
          });
          if (!tokenBalance || tokenBalance.amount < amountTokensWei) {
            throw new Error('Insufficient token balance to sell');
          }

          // Deduct token balance
          await tx.userTokenBalance.update({
            where: { walletAddress_tokenAddress: { walletAddress: userWallet, tokenAddress: token.mint } },
            data: { amount: { decrement: amountTokensWei } },
          });

          // Credit USDT
          if (usdtBalance) {
            await tx.userBalance.update({
              where: { id: usdtBalance.id },
              data: { available: { increment: amountUsdtWei } },
            });
          } else {
            await tx.userBalance.create({
              data: {
                walletAddress: userWallet,
                chainId: BSC_CHAIN_ID,
                asset: PAYMENT_ASSET,
                available: amountUsdtWei,
              },
            });
          }

          // Roll back the bonding curve supply (raw integer units)
          const newSupply = token.currentSupply - amountTokensRaw;
          await tx.token.update({
            where: { id: token.id },
            data: { currentSupply: newSupply > 0n ? newSupply : 0n },
          });
        }

        // Record trade activity
        const trade = await tx.trade.create({
          data: {
            tokenMint: token.mint,
            tokenAddress: token.tokenAddress,
            walletAddress: userWallet,
            type,
            amount: amountTokensWei,
            solAmount: amountUsdtWei,
            paymentAmount: amountUsdtWei,
            paymentAsset: PAYMENT_ASSET,
            pricePerToken: amountTokens > 0 ? BigInt(Math.round((amountUsdt / amountTokens) * 1e6)) : 0n,
            txSignature: `internal-${type}-${Date.now()}`,
            timestamp: new Date(),
            isWhale: amountUsdt >= 1000,
          },
        });

        const finalSupply = type === 'buy'
          ? token.currentSupply + amountTokensRaw
          : token.currentSupply - amountTokensRaw;

        return { trade, newSupply: finalSupply.toString(), graduated: type === 'buy' && finalSupply >= token.graduationThreshold };
      });

      return reply.send({ success: true, ...result });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message, code: 'TRADE_ERROR' });
    }
  });

  // ── GET /api/tokens/:address/my-balance ─────────────────────────────────────
  // Returns the calling wallet's platform token balance for a specific token.
  app.get('/api/tokens/:address/my-balance', async (req, reply) => {
    const { wallet } = req.query as { wallet?: string };
    if (!wallet) return reply.code(400).send({ error: 'wallet query param required' });

    const { address: tokenAddressParam } = req.params as { address: string };
    const tokenAddress = tokenAddressParam.toLowerCase();
    const userWallet = normalizeAddress(wallet)!;

    const token = await prisma.token.findFirst({
      where: { OR: [{ tokenAddress }, { mint: tokenAddress }] },
      select: { mint: true },
    });
    if (!token) return reply.code(404).send({ error: 'Token not found' });

    const tokenBalance = await prisma.userTokenBalance.findUnique({
      where: { walletAddress_tokenAddress: { walletAddress: userWallet, tokenAddress: token.mint } },
    });

    return reply.send({ amount: tokenBalance?.amount.toString() ?? '0' });
  });

  // ── POST /api/admin/tokens/:address/reset-status ─────────────────────────────
  // Admin-only: resets a stuck token back to 'active' for testing/recovery.
  app.post('/api/admin/tokens/:address/reset-status', async (req, reply) => {
    const secret = (req.headers['x-admin-secret'] as string) ?? '';
    if (secret !== (process.env.ADMIN_SECRET ?? 'limiance-admin')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const { address: tokenAddressParam } = req.params as { address: string };
    const tokenAddress = tokenAddressParam.toLowerCase();

    const token = await prisma.token.findFirst({
      where: { OR: [{ tokenAddress }, { mint: tokenAddress }] },
    });
    if (!token) return reply.code(404).send({ error: 'Token not found' });

    const updated = await prisma.token.update({
      where: { id: token.id },
      data: { status: 'active' },
    });

    return reply.send({ success: true, id: updated.id, status: updated.status });
  });
}
