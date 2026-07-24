"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const tokens_1 = require("./routes/tokens");
const auth_1 = require("./routes/auth");
const upload_1 = require("./routes/upload");
const webhook_1 = require("./routes/webhook");
const activity_1 = require("./routes/activity");
const chart_1 = require("./routes/chart");
const profiles_1 = require("./routes/profiles");
const comments_1 = require("./routes/comments");
const follows_1 = require("./routes/follows");
const deposits_1 = require("./routes/deposits");
const reports_1 = require("./routes/reports");
const adminAuth_1 = require("./routes/adminAuth");
const adminData_1 = require("./routes/adminData");
const adminActions_1 = require("./routes/adminActions");
const prisma_1 = require("./services/prisma");
const production_1 = require("./services/production");
const server_1 = require("./ws/server");
const indexer_1 = require("./services/indexer");
const hotWallet_1 = require("./services/hotWallet");
const PORT = parseInt(process.env.PORT ?? '4000', 10);
const IS_DEV = process.env.NODE_ENV !== 'production';
async function main() {
    (0, production_1.assertProductionConfig)();
    const app = (0, fastify_1.default)({
        logger: {
            level: IS_DEV ? 'info' : 'warn',
        },
    });
    // ── Plugins ─────────────────────────────────────────────────────────────────
    const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
        : [];
    await app.register(cors_1.default, {
        origin: IS_DEV || allowedOrigins.length === 0 ? true : allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    });
    await app.register(rate_limit_1.default, {
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
    await app.register(multipart_1.default, {
        limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    });
    await app.register(websocket_1.default);
    // ── Routes ───────────────────────────────────────────────────────────────────
    await app.register(auth_1.authRoutes);
    await app.register(tokens_1.tokenRoutes);
    await app.register(upload_1.uploadRoutes);
    await app.register(webhook_1.webhookRoutes);
    await app.register(activity_1.activityRoutes);
    await app.register(chart_1.chartRoutes);
    await app.register(profiles_1.profileRoutes);
    await app.register(comments_1.commentRoutes);
    await app.register(follows_1.followRoutes);
    await app.register(deposits_1.depositRoutes);
    await app.register(reports_1.reportRoutes);
    await app.register(adminAuth_1.adminAuthRoutes);
    await app.register(adminData_1.adminDataRoutes);
    await app.register(adminActions_1.adminActionRoutes);
    // ── WebSocket endpoint ───────────────────────────────────────────────────────
    app.get('/ws', { websocket: true }, (socket) => {
        (0, server_1.addClient)(socket);
        socket.on('close', () => (0, server_1.removeClient)(socket));
        socket.on('error', () => (0, server_1.removeClient)(socket));
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
        await prisma_1.prisma.$connect();
        app.log.info('Database connected');
    }
    catch (err) {
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
            (0, indexer_1.runIndexer)().catch(err => app.log.error('Indexer failed', err));
            (0, hotWallet_1.runHotWalletWorker)().catch(err => app.log.error('Hot Wallet failed', err));
        }
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
    process.on('SIGTERM', async () => {
        await app.close();
        await prisma_1.prisma.$disconnect();
        process.exit(0);
    });
}
main();
//# sourceMappingURL=index.js.map