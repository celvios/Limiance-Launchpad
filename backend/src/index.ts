import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyWebsocket from '@fastify/websocket';

import { tokenRoutes } from './routes/tokens';
import { uploadRoutes } from './routes/upload';
import { webhookRoutes } from './routes/webhook';
import { activityRoutes } from './routes/activity';
import { chartRoutes } from './routes/chart';
import { profileRoutes } from './routes/profiles';
import { commentRoutes } from './routes/comments';
import { followRoutes } from './routes/follows';
import { prisma } from './services/prisma';
import { addClient, removeClient } from './ws/server';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const IS_DEV = process.env.NODE_ENV !== 'production';

const app = Fastify({
  logger: {
    level: IS_DEV ? 'info' : 'warn',
    ...(IS_DEV && {
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    }),
  },
});

// ── Plugins ───────────────────────────────────────────────────────────────────

await app.register(cors, {
  origin: IS_DEV ? true : (process.env.ALLOWED_ORIGINS ?? '').split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

await app.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip,
});

await app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
});

// WebSocket support — clients connect at GET /ws
await app.register(fastifyWebsocket);

// ── Routes ────────────────────────────────────────────────────────────────────

await app.register(tokenRoutes);
await app.register(uploadRoutes);
await app.register(webhookRoutes);
await app.register(activityRoutes);
await app.register(chartRoutes);
await app.register(profileRoutes);
await app.register(commentRoutes);
await app.register(followRoutes);

// ── WebSocket endpoint ────────────────────────────────────────────────────────

app.get('/ws', { websocket: true }, (socket) => {
  addClient(socket);
  socket.on('close', () => removeClient(socket));
  socket.on('error', () => removeClient(socket));
});

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/health', async () => {
  return { status: 'ok', timestamp: Date.now() };
});

// ── Global error handler ──────────────────────────────────────────────────────

app.setErrorHandler((error, req, reply) => {
  app.log.error(error);
  if (reply.statusCode >= 500 || !reply.statusCode) {
    return reply.code(500).send({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
  return reply.send({ error: error.message, code: 'ERROR' });
});

// ── Startup ───────────────────────────────────────────────────────────────────

async function start() {
  try {
    await prisma.$connect();
    app.log.info('Database connected');
  } catch (err) {
    app.log.error('Database connection failed:', err);
    process.exit(1);
  }

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`API server running on http://0.0.0.0:${PORT}`);
    app.log.info(`WebSocket endpoint: ws://0.0.0.0:${PORT}/ws`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
});

start();
