import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import {
  BSC_CHAIN_ID,
  PAYMENT_ASSET,
  isSupportedAsset,
  normalizeAddress,
  predictVaultAddress,
} from '../services/bsc';
import { authenticateSession } from '../lib/jwt';

const DepositAddressQuery = z.object({
  wallet: z.string().optional(),
  asset: z.string().default(PAYMENT_ASSET),
  chainId: z.coerce.number().default(BSC_CHAIN_ID),
});

const CreditDepositBody = z.object({
  userId: z.string().optional(),
  userWallet: z.string(),
  vaultAddress: z.string(),
  asset: z.string().default(PAYMENT_ASSET),
  chainId: z.coerce.number().default(BSC_CHAIN_ID),
  amount: z.string().regex(/^\d+$/),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  logIndex: z.number().int().min(0).default(0),
  confirmations: z.number().int().min(0).default(0),
});

function serializeBalance(row: any) {
  return {
    userId: row.userId ?? null,
    walletAddress: row.walletAddress,
    chainId: row.chainId,
    asset: row.asset,
    available: row.available.toString(),
    consumed: row.consumed.toString(),
  };
}

export async function depositRoutes(app: FastifyInstance) {
  app.get('/api/users/me/deposit-address', async (req, reply) => {
    const session = authenticateSession(req.headers.authorization);
    if (!session?.wallet) {
      return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const parsed = DepositAddressQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
    }

    const userWallet = normalizeAddress(session.wallet);
    const asset = normalizeAddress(parsed.data.asset);
    if (!isSupportedAsset(asset)) {
      return reply.code(400).send({ error: 'Unsupported deposit asset', code: 'UNSUPPORTED_ASSET' });
    }

    const vaultAddress = await predictVaultAddress(userWallet, asset);
    const depositAddress = await (prisma as any).depositAddress.upsert({
      where: {
        userWallet_chainId_asset: {
          userWallet,
          chainId: parsed.data.chainId,
          asset,
        },
      },
      update: { vaultAddress, status: 'active', userId: session.userId ?? undefined },
      create: {
        userId: session.userId ?? undefined,
        userWallet,
        chainId: parsed.data.chainId,
        asset,
        vaultAddress,
      },
    });

    return reply.send({
      userId: session.userId ?? null,
      userWallet,
      chainId: depositAddress.chainId,
      asset,
      vaultAddress,
      status: depositAddress.status,
      createdAt: depositAddress.createdAt.getTime(),
    });
  });

  app.get('/api/deposits/address', async (req, reply) => {
    const parsed = DepositAddressQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
    }

    if (!parsed.data.wallet) {
      return reply.code(400).send({ error: 'wallet is required', code: 'VALIDATION_ERROR' });
    }
    const userWallet = normalizeAddress(parsed.data.wallet);
    const asset = normalizeAddress(parsed.data.asset);
    if (!isSupportedAsset(asset)) {
      return reply.code(400).send({ error: 'Unsupported deposit asset', code: 'UNSUPPORTED_ASSET' });
    }

    const vaultAddress = await predictVaultAddress(userWallet, asset);
    const depositAddress = await (prisma as any).depositAddress.upsert({
      where: {
        userWallet_chainId_asset: {
          userWallet,
          chainId: parsed.data.chainId,
          asset,
        },
      },
      update: { vaultAddress, status: 'active' },
      create: {
        userWallet,
        chainId: parsed.data.chainId,
        asset,
        vaultAddress,
      },
    });

    return reply.send({
      userWallet,
      chainId: depositAddress.chainId,
      asset,
      vaultAddress,
      status: depositAddress.status,
      createdAt: depositAddress.createdAt.getTime(),
    });
  });

  app.get('/api/deposits/balance/:wallet', async (req, reply) => {
    const { wallet } = req.params as { wallet: string };
    const walletAddress = normalizeAddress(wallet);
    const balances = await (prisma as any).userBalance.findMany({
      where: { walletAddress },
      orderBy: { updatedAt: 'desc' },
    });
    return reply.send({ balances: balances.map(serializeBalance) });
  });

  app.get('/api/deposits/history/:wallet', async (req, reply) => {
    const { wallet } = req.params as { wallet: string };
    const walletAddress = normalizeAddress(wallet);
    const deposits = await (prisma as any).deposit.findMany({
      where: { userWallet: walletAddress },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return reply.send({
      deposits: deposits.map((deposit: any) => ({
        id: deposit.id,
        vaultAddress: deposit.vaultAddress,
        userWallet: deposit.userWallet,
        chainId: deposit.chainId,
        asset: deposit.asset,
        amount: deposit.amount.toString(),
        txHash: deposit.txHash,
        confirmations: deposit.confirmations,
        credited: deposit.credited,
        consumed: deposit.consumed,
        createdAt: deposit.createdAt.getTime(),
      })),
    });
  });

  app.post('/api/deposits/credit', async (req, reply) => {
    const expectedSecret = process.env.INDEXER_SECRET;
    if (expectedSecret) {
      const provided = req.headers['x-indexer-secret'];
      if (provided !== expectedSecret) {
        return reply.code(401).send({ error: 'Unauthorized indexer', code: 'UNAUTHORIZED' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      return reply.code(503).send({ error: 'Indexer secret is not configured', code: 'INDEXER_SECRET_REQUIRED' });
    }

    const parsed = CreditDepositBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
    }

    const userWallet = normalizeAddress(parsed.data.userWallet);
    const vaultAddress = normalizeAddress(parsed.data.vaultAddress);
    const asset = normalizeAddress(parsed.data.asset);
    if (!isSupportedAsset(asset)) {
      return reply.code(400).send({ error: 'Unsupported deposit asset', code: 'UNSUPPORTED_ASSET' });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const depositAddress = await tx.depositAddress.upsert({
        where: {
          userWallet_chainId_asset: {
            userWallet,
            chainId: parsed.data.chainId,
            asset,
          },
        },
        update: { vaultAddress, userId: parsed.data.userId },
        create: {
          userId: parsed.data.userId,
          userWallet,
          chainId: parsed.data.chainId,
          asset,
          vaultAddress,
        },
      });

      const txHash = parsed.data.txHash.toLowerCase();
      const existingDeposit = await tx.deposit.findUnique({
        where: { txHash_logIndex: { txHash, logIndex: parsed.data.logIndex } },
      });

      const deposit = existingDeposit
        ? await tx.deposit.update({
            where: { txHash_logIndex: { txHash, logIndex: parsed.data.logIndex } },
            data: { confirmations: parsed.data.confirmations },
          })
        : await tx.deposit.create({
          data: {
          depositAddressId: depositAddress.id,
          vaultAddress,
          userWallet,
          chainId: parsed.data.chainId,
          asset,
          amount: BigInt(parsed.data.amount),
          txHash,
          logIndex: parsed.data.logIndex,
          confirmations: parsed.data.confirmations,
          credited: true,
            },
          });

      if (!existingDeposit) {
        await tx.userBalance.upsert({
          where: {
            walletAddress_chainId_asset: {
              walletAddress: userWallet,
              chainId: parsed.data.chainId,
              asset,
            },
          },
          update: {
            userId: parsed.data.userId,
            available: { increment: BigInt(parsed.data.amount) },
          },
          create: {
            userId: parsed.data.userId,
            walletAddress: userWallet,
            chainId: parsed.data.chainId,
            asset,
            available: BigInt(parsed.data.amount),
          },
        });
      }

      return deposit;
    });

    return reply.code(201).send({ depositId: result.id, credited: result.credited });
  });
  app.post('/api/deposits/withdraw', async (req, reply) => {
    const session = authenticateSession(req.headers.authorization);
    if (!session?.wallet) {
      return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const WithdrawBody = z.object({
      amount: z.string().regex(/^\d+$/),
      asset: z.string().default(PAYMENT_ASSET),
      chainId: z.coerce.number().default(BSC_CHAIN_ID),
      destination: z.string(),
    });

    const parsed = WithdrawBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
    }

    const userWallet = normalizeAddress(session.wallet);
    const asset = normalizeAddress(parsed.data.asset);
    const destination = normalizeAddress(parsed.data.destination);
    const amountWei = BigInt(parsed.data.amount);

    if (amountWei <= 0n) {
      return reply.code(400).send({ error: 'Amount must be greater than 0', code: 'INVALID_AMOUNT' });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const balance = await tx.userBalance.findUnique({
        where: {
          walletAddress_chainId_asset: {
            walletAddress: userWallet,
            chainId: parsed.data.chainId,
            asset,
          },
        },
      });

      if (!balance || BigInt(balance.available) < amountWei) {
        throw new Error('Insufficient balance');
      }

      await tx.userBalance.update({
        where: { id: balance.id },
        data: {
          available: { decrement: amountWei },
        },
      });

      // Queue the withdrawal to be processed on-chain by the Hot Wallet Worker
      await tx.withdrawalRequest.create({
        data: {
          userId: session.userId ?? undefined,
          userWallet: userWallet,
          asset: asset,
          amount: amountWei,
          destination: destination,
          status: 'pending'
        }
      });
      
      return balance;
    });

    return reply.send({ success: true, newBalance: (result as any).available?.toString() });
  });

  app.post('/api/deposits/testnet-credit', async (req, reply) => {
    // ONLY allowed if environment is not strictly production requiring an indexer
    const session = authenticateSession(req.headers.authorization);
    if (!session?.wallet) {
      return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const TestnetCreditBody = z.object({
      amount: z.string().regex(/^\d+$/),
      asset: z.string().default(PAYMENT_ASSET),
      chainId: z.coerce.number().default(BSC_CHAIN_ID),
      txHash: z.string(), // We just trust the tx hash on testnet
    });

    const parsed = TestnetCreditBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
    }

    const userWallet = normalizeAddress(session.wallet);
    const asset = normalizeAddress(parsed.data.asset);
    
    // Check if txHash was already credited
    const existingDeposit = await (prisma as any).deposit.findFirst({
      where: { txHash: parsed.data.txHash }
    });

    if (existingDeposit) {
      return reply.code(400).send({ error: 'Transaction already credited', code: 'DUPLICATE_TX' });
    }

    const vaultAddress = await predictVaultAddress(userWallet, asset);

    const result = await prisma.$transaction(async (tx: any) => {
      // Create deposit record to prevent double crediting
      const depositAddress = await tx.depositAddress.upsert({
        where: {
          userWallet_chainId_asset: { userWallet, chainId: parsed.data.chainId, asset },
        },
        update: { vaultAddress, userId: session.userId ?? undefined },
        create: {
          userId: session.userId ?? undefined,
          userWallet,
          chainId: parsed.data.chainId,
          asset,
          vaultAddress,
        },
      });

      const deposit = await tx.deposit.create({
        data: {
          depositAddressId: depositAddress.id,
          vaultAddress,
          userWallet,
          chainId: parsed.data.chainId,
          asset,
          amount: BigInt(parsed.data.amount),
          txHash: parsed.data.txHash,
          logIndex: 0,
          confirmations: 1,
          credited: true,
        },
      });

      // Credit UserBalance
      await tx.userBalance.upsert({
        where: {
          walletAddress_chainId_asset: {
            walletAddress: userWallet,
            chainId: parsed.data.chainId,
            asset,
          },
        },
        update: {
          userId: session.userId ?? undefined,
          available: { increment: BigInt(parsed.data.amount) },
        },
        create: {
          userId: session.userId ?? undefined,
          walletAddress: userWallet,
          chainId: parsed.data.chainId,
          asset,
          available: BigInt(parsed.data.amount),
        },
      });

      return deposit;
    });

    return reply.send({ success: true, depositId: result.id });
  });
}
