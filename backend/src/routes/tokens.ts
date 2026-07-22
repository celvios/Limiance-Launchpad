import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { BSC_CHAIN_ID, normalizeAddress, TOKEN_CREATION_FEE_USDT, PAYMENT_ASSET } from '../services/bsc';
import { authenticateSession } from '../lib/jwt';
import { broadcast } from '../ws/server';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const DeployBody = z.object({
  creator: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  name: z.string().min(1).max(32),
  symbol: z.string().min(1).max(10),
  description: z.string().max(500).default(''),
  imageUri: z.string().default(''),
  totalSupply: z.number().int().positive(),
  initialBuyAmount: z.number().int().min(0).default(0),
  graduationThreshold: z.number().min(40).max(100),
  curveParams: z.object({
    pMin: z.number().positive().optional(),
    pMax: z.number().positive().optional(),
    k: z.number().optional(),
    midpoint: z.number().optional(),
  }).passthrough().superRefine((params, ctx) => {
    if (params.pMin !== undefined && params.pMax !== undefined && params.pMax <= params.pMin) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pMax'], message: 'pMax must be greater than pMin' });
    }
  }),
});

const FeedQuery = z.object({
  filter: z.enum(['new', 'trending', 'near_grad', 'graduated', 'following']).default('new'),
  sort: z.enum(['marketCap', 'volume24h', 'age', 'holders']).optional(),
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
  volume24h: number;
  totalRaised: number;
}

function emptyCounts(): TokenSocialCounts {
  return { commentCount: 0, holderCount: 0, watchCount: 0, volume24h: 0, totalRaised: 0 };
}

async function fetchTokenSocialCounts(tokenMints: string[]): Promise<Map<string, TokenSocialCounts>> {
  const uniqueMints = [...new Set(tokenMints)].filter(Boolean);
  const countMap = new Map(uniqueMints.map((mint) => [mint, emptyCounts()]));
  if (uniqueMints.length === 0) return countMap;

  const [commentCounts, watchCounts, holderRows, volRows, raisedRows] = await Promise.all([
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
    prisma.userTokenBalance.findMany({
      where: { tokenAddress: { in: uniqueMints }, amount: { gt: 0n } },
      select: { tokenAddress: true, walletAddress: true },
    }),
    prisma.trade.groupBy({
      by: ['tokenMint'],
      where: { 
        tokenMint: { in: uniqueMints },
        timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      _sum: { solAmount: true },
    }),
    prisma.trade.groupBy({
      by: ['tokenMint'],
      where: { tokenMint: { in: uniqueMints }, type: 'buy' },
      _sum: { solAmount: true },
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

  const holdersByToken = new Map<string, Set<string>>();
  for (const row of holderRows) {
    const holders = holdersByToken.get(row.tokenAddress) ?? new Set<string>();
    holders.add(row.walletAddress);
    holdersByToken.set(row.tokenAddress, holders);
  }

  for (const [tokenMint, holders] of holdersByToken) {
    const current = countMap.get(tokenMint) ?? emptyCounts();
    countMap.set(tokenMint, { ...current, holderCount: holders.size });
  }

  for (const row of volRows) {
    const current = countMap.get(row.tokenMint) ?? emptyCounts();
    countMap.set(row.tokenMint, { 
      ...current, 
      volume24h: row._sum.solAmount ? Number(row._sum.solAmount) / 1e6 : 0 
    });
  }

  for (const row of raisedRows) {
    const current = countMap.get(row.tokenMint) ?? emptyCounts();
    countMap.set(row.tokenMint, { 
      ...current, 
      totalRaised: row._sum.solAmount ? Number(row._sum.solAmount) / 1e6 : 0 
    });
  }

  return countMap;
}

// ─── Exponential Bonding Curve ────────────────────────────────────────────────
// Price formula: Price(supply) = pMin * (pMax/pMin)^(supply / graduationThreshold)
//   supply=0  → price = pMin   (starting price)
//   supply=GT → price = pMax   (graduation price)
// Every single buy immediately pushes the price up — no flat tail.

function getExponentialPrice(
  supply: number,
  pMin: number,
  pMax: number,
  graduationThreshold: number,
): number {
  if (graduationThreshold <= 0 || pMin <= 0 || pMax <= pMin) return pMin;
  return pMin * Math.pow(pMax / pMin, supply / graduationThreshold);
}

/**
 * Exact closed-form integral: total USDT cost to buy `supply` tokens from 0.
 *   ∫₀ˢ pMin*(pMax/pMin)^(x/GT) dx = pMin*GT/ln(pMax/pMin) * [(pMax/pMin)^(s/GT) - 1]
 */
function getExponentialIntegral(
  supply: number,
  pMin: number,
  pMax: number,
  graduationThreshold: number,
): number {
  if (graduationThreshold <= 0 || pMin <= 0) return 0;
  if (pMax <= pMin) return pMin * supply;
  const ratio = pMax / pMin;
  const lnRatio = Math.log(ratio);
  return (pMin * graduationThreshold / lnRatio) * (Math.pow(ratio, supply / graduationThreshold) - 1);
}

/**
 * Given a USDT payment, returns the number of tokens received starting from currentSupply.
 * Uses the exact analytical inverse of the cost integral.
 */
function estimateBuyTokensForPayment(
  paymentUsdt: number,
  currentSupply: number,
  pMin: number,
  pMax: number,
  graduationThreshold: number,
): number {
  if (paymentUsdt <= 0) return 0;
  const remaining = Math.max(0, graduationThreshold - currentSupply);
  if (remaining <= 0) return 0;
  if (pMax <= pMin) return Math.min(Math.floor(paymentUsdt / pMin), remaining);

  const ratio = pMax / pMin;
  const lnRatio = Math.log(ratio);
  const priceAtCurrent = pMin * Math.pow(ratio, currentSupply / graduationThreshold);
  const tokensOut = (graduationThreshold / lnRatio) *
    Math.log(1 + (paymentUsdt * lnRatio) / (priceAtCurrent * graduationThreshold));

  return Math.floor(Math.min(tokensOut, remaining));
}

function getExponentialCostBetween(
  fromSupply: number,
  toSupply: number,
  pMin: number,
  pMax: number,
  graduationThreshold: number,
): number {
  if (toSupply <= fromSupply) return 0;
  return (
    getExponentialIntegral(toSupply, pMin, pMax, graduationThreshold) -
    getExponentialIntegral(fromSupply, pMin, pMax, graduationThreshold)
  );
}

function estimateSellUsdtForTokens(
  tokenAmount: number,
  currentSupply: number,
  pMin: number,
  pMax: number,
  graduationThreshold: number,
): number {
  if (tokenAmount <= 0 || tokenAmount > currentSupply) return 0;
  const fromSupply = Math.max(0, currentSupply - tokenAmount);
  const gross = getExponentialCostBetween(fromSupply, currentSupply, pMin, pMax, graduationThreshold);
  return gross * 0.95;
}

async function serializeToken(token: any, creatorHandle?: string | null, counts: TokenSocialCounts = emptyCounts()) {
  const tokenAddress = token.tokenAddress ?? token.mint;
  const supply = Number(token.currentSupply.toString());
  const cap = Number(token.supplyCap.toString());
  const pMax = Number(token.curveParamA.toString()) / 1e18;
  const pMin = Number(token.curveParamB.toString()) / 1e18;
  const graduationThresholdNum = Number(token.graduationThreshold);

  const currentPrice = getExponentialPrice(supply, pMin, pMax, graduationThresholdNum);
  const totalRaised = counts.totalRaised;
  // Market cap = current price × total supply cap (fully diluted)
  const marketCap = cap > 0 ? currentPrice * cap : 0;
  // Circulating market cap = current price × tokens already sold
  const circulatingMarketCap = currentPrice * supply;

  // ── Real 24h price change ────────────────────────────────────────────────────
  // Find the oldest trade from 24h ago; if none, use pMin (starting price) as baseline.
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const trade24hAgo = await prisma.trade.findFirst({
    where: { tokenMint: tokenAddress, timestamp: { lte: cutoff24h } },
    orderBy: { timestamp: 'desc' },
    select: { pricePerToken: true },
  });
  // price24h: use stored trade price OR fall back to pMin for brand-new tokens
  const price24h = trade24hAgo
    ? Number(trade24hAgo.pricePerToken) / 1e18
    : pMin;
  const priceChange24h = price24h > 0
    ? ((currentPrice - price24h) / price24h) * 100
    : 0;

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
    curveType: 'exponential',
    curveParams: { type: 'exponential', pMin, pMax },
    currentSupply: supply,
    supplyCap: cap,
    graduationThreshold: graduationThresholdNum,
    status: token.status,
    price: currentPrice,
    priceChange24h: Math.round(priceChange24h * 100) / 100,
    marketCap,
    circulatingMarketCap,
    commentCount: counts.commentCount,
    watchCount: counts.watchCount,
    sparklineData: [],
    volume24h: counts.volume24h,
    holderCount: counts.holderCount,
    totalSupply: cap,
    basePrice: pMin,
    platformFee: 3,
    totalRaised,
    dexPoolAddress: token.dexPoolAddress ?? null,
  };
}

export async function tokenRoutes(app: FastifyInstance) {
  app.post('/api/tokens/deploy', async (req, reply) => {
    const session = authenticateSession(req.headers.authorization);
    if (!session?.wallet) {
      return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const parsed = DeployBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
    }

    try {
      const body = parsed.data;
      const creator = normalizeAddress(session.wallet);
      if (normalizeAddress(body.creator) !== creator) {
        return reply.code(403).send({ error: 'Creator wallet does not match session', code: 'FORBIDDEN' });
      }
      const tokenAddress = pseudoAddress(`${creator}:${body.symbol}:${Date.now()}`);
      const saleAddress = pseudoAddress(`${tokenAddress}:sale`);
      const supplyCap = BigInt(body.totalSupply);
      const graduationThreshold = (supplyCap * BigInt(body.graduationThreshold)) / 100n;
      const pMax = body.curveParams.pMax ?? 0.1;
      const pMin = body.curveParams.pMin ?? 0.00001;

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
          curveType: 'exponential',
          curveParamA: toWei(pMax),
          curveParamB: toWei(pMin),
          curveParamC: 0n, // unused for exponential curve
          status: 'active',
        },
      });

      // Calculate costs and solAmount
      let initialSolAmountWei = 0n;
      let costUsdt = 0;
      if (body.initialBuyAmount > 0) {
        costUsdt = getExponentialIntegral(body.initialBuyAmount, pMin, pMax, Number(graduationThreshold));
        initialSolAmountWei = BigInt(Math.floor(costUsdt * 1e6));
      }

      const creationFeeUsdt = TOKEN_CREATION_FEE_USDT; // Read from RENDER env var
      const initialBuyFeeUsdt = costUsdt * 0.01;
      const totalCostUsdt = costUsdt + initialBuyFeeUsdt + creationFeeUsdt;
      const totalCostWei = BigInt(Math.floor(totalCostUsdt * 1e6));

      // Charge the user — check balance first
      const balances = await prisma.userBalance.findMany({
        where: {
          walletAddress: creator,
          asset: PAYMENT_ASSET,
        },
      });
      const availableWei = balances.reduce((sum, row) => sum + row.available, 0n);
      if (availableWei < totalCostWei) {
        // Roll back token creation and return error
        await prisma.token.delete({ where: { id: token.id } });
        return reply.code(402).send({
          error: `Insufficient balance. Need ${totalCostUsdt.toFixed(2)} USDT (${creationFeeUsdt} fee + ${costUsdt.toFixed(2)} initial buy + ${initialBuyFeeUsdt.toFixed(2)} initial buy fee).`,
          code: 'INSUFFICIENT_BALANCE',
          required: totalCostWei.toString(),
          creationFee: BigInt(Math.floor(creationFeeUsdt * 1e6)).toString(),
        });
      }

      let remainingDebit = totalCostWei;
      const debitRows = [...balances].sort((a, b) => {
        if (a.chainId === BSC_CHAIN_ID && b.chainId !== BSC_CHAIN_ID) return -1;
        if (a.chainId !== BSC_CHAIN_ID && b.chainId === BSC_CHAIN_ID) return 1;
        return b.available > a.available ? 1 : -1;
      });

      for (const row of debitRows) {
        if (remainingDebit <= 0n) break;
        const debitAmount = row.available < remainingDebit ? row.available : remainingDebit;
        if (debitAmount <= 0n) continue;
        await prisma.userBalance.update({
          where: { id: row.id },
          data: {
            available: { decrement: debitAmount },
            consumed: { increment: debitAmount },
          },
        });
        remainingDebit -= debitAmount;
      }

      if (body.initialBuyAmount > 0) {
        const initialTokenAmountRaw = BigInt(body.initialBuyAmount);
        const initialTokenAmountWei = initialTokenAmountRaw * 1_000_000n;

        await prisma.userTokenBalance.upsert({
          where: {
            walletAddress_tokenAddress: {
              walletAddress: creator,
              tokenAddress,
            },
          },
          update: { amount: { increment: initialTokenAmountWei } },
          create: {
            walletAddress: creator,
            tokenAddress,
            amount: initialTokenAmountWei,
          },
        });

        await prisma.trade.create({
          data: {
            tokenMint: tokenAddress,
            tokenAddress,
            walletAddress: creator,
            type: 'buy',
            amount: initialTokenAmountWei,
            solAmount: initialSolAmountWei,
            paymentAmount: initialSolAmountWei,
            paymentAsset: PAYMENT_ASSET,
            pricePerToken: initialTokenAmountRaw > 0n ? BigInt(Math.round((costUsdt / body.initialBuyAmount) * 1e18)) : toWei(pMin),
            txSignature: `initial-buy-${token.id}`,
            timestamp: new Date(),
            isWhale: costUsdt >= 1000,
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

    let orderBy: any = { createdAt: 'desc' };
    if (parsed.data.sort === 'marketCap') orderBy = { currentSupply: 'desc' }; // approximation of MC
    else if (parsed.data.sort === 'holders') orderBy = { holderCount: 'desc' };
    else if (parsed.data.sort === 'volume24h') orderBy = { volume24h: 'desc' };

    const tokens = await prisma.token.findMany({
      where,
      orderBy,
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
      tokens: await Promise.all(page.map((t) => serializeToken(t, profileMap.get(t.creator), countMap.get(t.mint)))),
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

    const serializedToken = await serializeToken(token, creatorHandle, countMap.get(token.mint));
    return reply.send({ ...serializedToken, creatorPicUri: creatorPic });
  });

  app.post('/api/tokens/:address/trade', async (req, reply) => {
    // Authenticated Balance Trade — fully backend-tracked (no on-chain tx per trade)
    const session = authenticateSession(req.headers.authorization);
    if (!session?.wallet) {
      return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const TradeBody = z.object({
      wallet: z.string(),
      type: z.enum(['buy', 'sell']),
      amountUsdt: z.number().positive(),   // USDT to spend (buy) or USDT to receive (sell)
      amountTokens: z.number().nonnegative().optional(), // Optional for buys; required for sells
    });

    const parsed = TradeBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
    }

    const { wallet, type, amountUsdt } = parsed.data;
    const userWallet = normalizeAddress(wallet)!;
    if (normalizeAddress(session.wallet) !== userWallet) {
      return reply.code(403).send({ error: 'Wallet does not match session', code: 'FORBIDDEN' });
    }
    const { address: tokenAddressParam } = req.params as { address: string };
    const tokenAddress = tokenAddressParam.toLowerCase();

    // USDT: 6 decimals for DB storage.
    const requestedAmountUsdtWei = BigInt(Math.round(amountUsdt * 1e6));

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

        const pMax = Number(token.curveParamA.toString()) / 1e18;
        const pMin = Number(token.curveParamB.toString()) / 1e18;
        const currentSupply = Number(token.currentSupply.toString());
        const graduationThreshold = Number(token.graduationThreshold.toString());
        const resolvedAmountTokens = type === 'buy'
          ? estimateBuyTokensForPayment(amountUsdt, currentSupply, pMin, pMax, graduationThreshold)
          : (parsed.data.amountTokens ?? 0);

        if (resolvedAmountTokens <= 0) {
          throw new Error(type === 'buy' ? 'Amount is too small for the current curve price' : 'Token amount must be greater than 0');
        }

        // Tokens: TWO representations needed:
        //   amountTokensRaw = raw integer units for currentSupply/graduationThreshold.
        //   amountTokensWei = 6-decimal units for UserTokenBalance.
        const amountTokensRaw = BigInt(Math.round(resolvedAmountTokens));
        const amountTokensWei = BigInt(Math.round(resolvedAmountTokens * 1e6));
        const trustedAmountUsdt = type === 'buy'
          ? amountUsdt
          : estimateSellUsdtForTokens(resolvedAmountTokens, currentSupply, pMin, pMax, graduationThreshold);
        const trustedAmountUsdtWei = BigInt(Math.floor(trustedAmountUsdt * 1e6));

        if (type === 'buy') {
          // ── BUY ──────────────────────────────────────────────────────────────
          if (!usdtBalance || usdtBalance.available < requestedAmountUsdtWei) {
            throw new Error('Insufficient USDT balance — please deposit more');
          }

          // Deduct USDT
          await tx.userBalance.update({
            where: { id: usdtBalance.id },
            data: { available: { decrement: requestedAmountUsdtWei }, consumed: { increment: requestedAmountUsdtWei } },
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
          if (trustedAmountUsdtWei <= 0n) {
            throw new Error('Sell amount is too small for the current curve price');
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
              data: { available: { increment: trustedAmountUsdtWei } },
            });
          } else {
            await tx.userBalance.create({
              data: {
                walletAddress: userWallet,
                chainId: BSC_CHAIN_ID,
                asset: PAYMENT_ASSET,
                available: trustedAmountUsdtWei,
              },
            });
          }

          // Roll back the bonding curve supply (raw integer units)
          const newSupply = token.currentSupply - amountTokensRaw;
          const clampedSupply = newSupply > 0n ? newSupply : 0n;
          await tx.token.update({
            where: { id: token.id },
            data: {
              currentSupply: clampedSupply,
              status: clampedSupply >= token.graduationThreshold ? token.status : 'active',
            },
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
            solAmount: type === 'buy' ? requestedAmountUsdtWei : trustedAmountUsdtWei,
            paymentAmount: type === 'buy' ? requestedAmountUsdtWei : trustedAmountUsdtWei,
            paymentAsset: PAYMENT_ASSET,
            pricePerToken: resolvedAmountTokens > 0 ? BigInt(Math.round((trustedAmountUsdt / resolvedAmountTokens) * 1e18)) : 0n,
            txSignature: `internal-${type}-${Date.now()}`,
            timestamp: new Date(),
            isWhale: amountUsdt >= 1000,
          },
        });

        const finalSupply = type === 'buy'
          ? token.currentSupply + amountTokensRaw
          : token.currentSupply - amountTokensRaw;
        const clampedFinalSupply = finalSupply > 0n ? finalSupply : 0n;

        return {
          trade: {
            ...trade,
            amount: trade.amount.toString(),
            solAmount: trade.solAmount.toString(),
            paymentAmount: trade.paymentAmount?.toString() ?? null,
            pricePerToken: trade.pricePerToken.toString(),
          },
          tokenSymbol: token.symbol,
          newSupply: clampedFinalSupply.toString(),
          graduated: type === 'buy' && clampedFinalSupply >= token.graduationThreshold
        };
      });

      broadcast({
        id: result.trade.id,
        type: result.trade.type,
        tokenMint: result.trade.tokenMint,
        tokenSymbol: result.tokenSymbol,
        amount: Number(result.trade.amount) / 1e6,
        solAmount: Number(result.trade.solAmount) / 1e6,
        walletAddress: result.trade.walletAddress,
        txSignature: result.trade.txSignature,
        timestamp: new Date(result.trade.timestamp).getTime(),
        isWhale: result.trade.isWhale,
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
  // Pass ?resetSupply=true to also zero out currentSupply (fixes corrupted scale data).
  app.post('/api/admin/tokens/:address/reset-status', async (req, reply) => {
    const secret = (req.headers['x-admin-secret'] as string) ?? '';
    if (secret !== (process.env.ADMIN_SECRET ?? 'limiance-admin')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const { address: tokenAddressParam } = req.params as { address: string };
    const tokenAddress = tokenAddressParam.toLowerCase();
    const { resetSupply } = req.query as { resetSupply?: string };

    const token = await prisma.token.findFirst({
      where: { OR: [{ tokenAddress }, { mint: tokenAddress }] },
    });
    if (!token) return reply.code(404).send({ error: 'Token not found' });

    const updated = await prisma.token.update({
      where: { id: token.id },
      data: {
        status: 'active',
        ...(resetSupply === 'true' ? { currentSupply: 0n } : {}),
      },
    });

    return reply.send({ success: true, id: updated.id, status: updated.status, currentSupply: updated.currentSupply.toString() });
  });

  // ── GET /api/admin/diagnose ───────────────────────────────────────────────────
  // Returns full DB state for debugging. Protected by admin secret.
  app.get('/api/admin/diagnose', async (req, reply) => {
    const secret = (req.headers['x-admin-secret'] as string) ?? '';
    if (secret !== (process.env.ADMIN_SECRET ?? 'limiance-admin')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const tokens = await prisma.token.findMany({
      select: {
        mint: true, symbol: true, name: true,
        currentSupply: true, supplyCap: true, graduationThreshold: true,
        curveParamA: true, curveParamB: true, curveParamC: true,
        status: true, createdAt: true,
      }
    });

    const tokenBals = await prisma.userTokenBalance.findMany();
    const trades = await prisma.trade.findMany({
      orderBy: { timestamp: 'asc' },
      select: {
        id: true, tokenMint: true, type: true, walletAddress: true,
        amount: true, solAmount: true, pricePerToken: true, timestamp: true,
      }
    });
    const usdtBals = await prisma.userBalance.findMany();

    return reply.send({
      tokens: tokens.map(t => ({
        symbol: t.symbol,
        name: t.name,
        mint: t.mint,
        currentSupply: t.currentSupply.toString(),
        supplyCap: t.supplyCap.toString(),
        graduationThreshold: t.graduationThreshold.toString(),
        pMax_raw: t.curveParamA.toString(),
        pMin_raw: t.curveParamB.toString(),
        k_raw: t.curveParamC.toString(),
        pMax: Number(t.curveParamA) / 1e18,
        pMin: Number(t.curveParamB) / 1e18,
        k: Number(t.curveParamC) / 1e6,
        status: t.status,
        marketCapAtCurrentSupply: (Number(t.curveParamB) / 1e18) * Number(t.supplyCap),
      })),
      userTokenBalances: tokenBals.map(b => ({
        wallet: b.walletAddress,
        tokenAddress: b.tokenAddress,
        amountRaw: b.amount.toString(),
        amountHuman: Number(b.amount) / 1e6,
      })),
      trades: trades.map(t => ({
        id: t.id,
        tokenMint: t.tokenMint,
        type: t.type,
        wallet: t.walletAddress,
        tokenAmount: Number(t.amount) / 1e6,
        usdtAmount: Number(t.solAmount) / 1e6,
        pricePerTokenRaw: t.pricePerToken.toString(),
        pricePerTokenHuman: Number(t.pricePerToken) < 1e10 ? Number(t.pricePerToken) / 1e6 : Number(t.pricePerToken) / 1e18,
        timestamp: t.timestamp.toISOString(),
      })),
      usdtBalances: usdtBals.map(b => ({
        wallet: b.walletAddress,
        availableRaw: b.available.toString(),
        availableHuman: Number(b.available) / 1e6,
      })),
    });
  });

  // ── POST /api/admin/fix-supply ────────────────────────────────────────────────
  // Recomputes token.currentSupply from the sum of all buy/sell trades.
  // Also fixes UserTokenBalance by recomputing from trades per wallet.
  app.post('/api/admin/fix-supply', async (req, reply) => {
    const secret = (req.headers['x-admin-secret'] as string) ?? '';
    if (secret !== (process.env.ADMIN_SECRET ?? 'limiance-admin')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const tokens = await prisma.token.findMany({ select: { id: true, mint: true, symbol: true } });
    const results = [];

    for (const token of tokens) {
      // Sum all buy trades - sum all sell trades to get net supply
      const buyTrades = await prisma.trade.findMany({
        where: { tokenMint: token.mint, type: 'buy' },
        select: { amount: true, walletAddress: true },
      });
      const sellTrades = await prisma.trade.findMany({
        where: { tokenMint: token.mint, type: 'sell' },
        select: { amount: true, walletAddress: true },
      });

      // Total supply = sum of buys - sum of sells (in amountTokensWei, i.e. tokens × 1e6)
      const totalBoughtWei = buyTrades.reduce((s, t) => s + t.amount, 0n);
      const totalSoldWei = sellTrades.reduce((s, t) => s + t.amount, 0n);
      const netSupplyWei = totalBoughtWei - totalSoldWei;
      // currentSupply is stored in raw token units (not × 1e6)
      const newCurrentSupply = netSupplyWei / 1_000_000n;

      await prisma.token.update({
        where: { id: token.id },
        data: { currentSupply: newCurrentSupply > 0n ? newCurrentSupply : 0n },
      });

      // Fix per-wallet token balances
      const wallets = new Set([
        ...buyTrades.map(t => t.walletAddress),
        ...sellTrades.map(t => t.walletAddress),
      ]);

      const walletResults = [];
      for (const wallet of wallets) {
        const bought = buyTrades.filter(t => t.walletAddress === wallet).reduce((s, t) => s + t.amount, 0n);
        const sold = sellTrades.filter(t => t.walletAddress === wallet).reduce((s, t) => s + t.amount, 0n);
        const netBalance = bought - sold;
        const finalBalance = netBalance > 0n ? netBalance : 0n;

        await prisma.userTokenBalance.upsert({
          where: { walletAddress_tokenAddress: { walletAddress: wallet, tokenAddress: token.mint } },
          create: { walletAddress: wallet, tokenAddress: token.mint, amount: finalBalance },
          update: { amount: finalBalance },
        });

        walletResults.push({ wallet, boughtRaw: bought.toString(), soldRaw: sold.toString(), netBalance: (Number(finalBalance) / 1e6).toFixed(2) });
      }

      results.push({
        symbol: token.symbol,
        mint: token.mint,
        newCurrentSupply: newCurrentSupply.toString(),
        wallets: walletResults,
      });
    }

    return reply.send({ success: true, results });
  });
}
