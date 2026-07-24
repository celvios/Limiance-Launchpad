import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyWebsocket from '@fastify/websocket';

import { tokenRoutes } from './routes/tokens';
import { authRoutes } from './routes/auth';
import { uploadRoutes } from './routes/upload';
import { webhookRoutes } from './routes/webhook';
import { activityRoutes } from './routes/activity';
import { chartRoutes } from './routes/chart';
import { profileRoutes } from './routes/profiles';
import { commentRoutes } from './routes/comments';
import { followRoutes } from './routes/follows';
import { depositRoutes } from './routes/deposits';
import { reportRoutes } from './routes/reports';
import { adminAuthRoutes } from './routes/adminAuth';
import { adminDataRoutes } from './routes/adminData';
import { adminActionRoutes } from './routes/adminActions';
import { prisma } from './services/prisma';
import { assertProductionConfig } from './services/production';
import { addClient, removeClient } from './ws/server';
import { runIndexer } from './services/indexer';
import { runHotWalletWorker } from './services/hotWallet';
import { authenticateSession } from './lib/jwt';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const IS_DEV = process.env.NODE_ENV !== 'production';

async function main() {
  assertProductionConfig();

  const app = Fastify({
    logger: {
      level: IS_DEV ? 'info' : 'warn',
    },
  });

  // Enforce suspensions for already-issued user JWTs as well as future logins.
  // Admin bearer tokens are a different JWT shape and are ignored here.
  app.addHook('preHandler', async (request, reply) => {
    if (request.url === '/health' || request.url.startsWith('/api/admin/')) return;
    const session = authenticateSession(request.headers.authorization);
    if (!session?.userId) return;
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { status: true } });
    if (user?.status === 'suspended') return reply.code(403).send({ error: 'Account suspended', code: 'ACCOUNT_SUSPENDED' });
  });

  // ── Plugins ─────────────────────────────────────────────────────────────────

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  await app.register(cors, {
    origin: IS_DEV || allowedOrigins.length === 0 ? true : allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      // Prefer per-user keying via JWT so shared Render/Vercel IPs don't collide
      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) {
        const token = auth.slice(7).trim();
        // Use first 16 chars of token as a cheap stable key (not a security concern — just routing)
        return `jwt:${token.slice(0, 32)}`;
      }
      return req.ip;
    },
  });

  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });

  await app.register(fastifyWebsocket);

  // ── Routes ───────────────────────────────────────────────────────────────────

  await app.register(authRoutes);
  await app.register(tokenRoutes);
  await app.register(uploadRoutes);
  await app.register(webhookRoutes);
  await app.register(activityRoutes);
  await app.register(chartRoutes);
  await app.register(profileRoutes);
  await app.register(commentRoutes);
  await app.register(followRoutes);
  await app.register(depositRoutes);
  await app.register(reportRoutes);
  await app.register(adminAuthRoutes);
  await app.register(adminDataRoutes);
  await app.register(adminActionRoutes);

  // ── WebSocket endpoint ───────────────────────────────────────────────────────

  app.get('/ws', { websocket: true }, (socket) => {
    addClient(socket);
    socket.on('close', () => removeClient(socket));
    socket.on('error', () => removeClient(socket));
  });

  // ── Health check ─────────────────────────────────────────────────────────────

  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  // ── Global error handler ──────────────────────────────────────────────────────

  app.setErrorHandler((error, _req, reply) => {
    app.log.error(error);
    if (!reply.statusCode || reply.statusCode >= 500) {
      return reply.code(500).send({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
    return reply.send({ error: error.message, code: 'ERROR' });
  });

  // ── DB connection ─────────────────────────────────────────────────────────────

  try {
    await prisma.$connect();
    app.log.info('Database connected');
  } catch (err) {
    app.log.error({ err }, 'Database connection failed');
    process.exit(1);
  }

  // ── Start listening ───────────────────────────────────────────────────────────

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`API server running on http://0.0.0.0:${PORT}`);
    app.log.info(`WebSocket: ws://0.0.0.0:${PORT}/ws`);

    // Start background workers
    if (IS_DEV || process.env.RUN_WORKERS === 'true') {
      runIndexer().catch(err => app.log.error('Indexer failed', err));
      runHotWalletWorker().catch(err => app.log.error('Hot Wallet failed', err));
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  process.on('SIGTERM', async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main();
