"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLoginMessage = buildLoginMessage;
exports.authRoutes = authRoutes;
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const jwt_1 = require("../lib/jwt");
const prisma_1 = require("../services/prisma");
const bsc_1 = require("../services/bsc");
const auth_1 = require("../lib/auth");
// The exact message the client must sign — must mirror session.ts on the frontend.
function buildLoginMessage(timestamp) {
    return `Limiance Launchpad\n\nSign to authenticate your BSC session.\n\nThis request will not trigger any blockchain transaction or cost gas.\n\nTimestamp: ${timestamp}`;
}
const LoginBody = zod_1.z.object({
    walletAddress: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    signature: zod_1.z.string().regex(/^0x[a-fA-F0-9]{130}$/),
    timestamp: zod_1.z.number().int().positive(),
    smartAccountAddress: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
    email: zod_1.z.string().email().optional(),
});
const RequestEmailBody = zod_1.z.object({
    email: zod_1.z.string().email(),
});
const VerifyEmailBody = zod_1.z.object({
    email: zod_1.z.string().email(),
    code: zod_1.z.string().regex(/^\d{6}$/),
    embeddedSignerAddress: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
    smartAccountAddress: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
});
function publicUser(user, sessionWallet) {
    return {
        token: (0, jwt_1.signToken)(sessionWallet, {
            userId: user.id,
            email: user.email ?? undefined,
            authType: user.authType ?? 'wallet',
        }),
        wallet: sessionWallet,
        userId: user.id,
        email: user.email ?? undefined,
        authType: user.authType ?? 'wallet',
        embeddedSignerAddress: user.embeddedSignerAddress ?? null,
        smartAccountAddress: user.smartAccountAddress ?? null,
    };
}
function isTimestampFresh(timestamp) {
    return Math.abs(Date.now() - timestamp) <= 5 * 60 * 1000;
}
function hashCode(email, code) {
    return crypto_1.default
        .createHash('sha256')
        .update(`${email.toLowerCase()}:${code}:${process.env.JWT_SECRET ?? 'change-me-in-production'}`)
        .digest('hex');
}
function generateOtp() {
    if (process.env.NODE_ENV !== 'production' && process.env.DEV_EMAIL_OTP) {
        return process.env.DEV_EMAIL_OTP;
    }
    return String(crypto_1.default.randomInt(100000, 1000000));
}
async function authRoutes(fastify) {
    // ── POST /api/auth/login ──────────────────────────────────────────────────
    fastify.post('/api/auth/login', {
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    }, async (req, reply) => {
        const parsed = LoginBody.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({
                error: parsed.error.issues[0]?.message ?? 'Invalid body',
                code: 'INVALID_BODY',
            });
        }
        const { walletAddress, signature, timestamp, smartAccountAddress, email } = parsed.data;
        // Reject stale or future-dated requests
        if (!isTimestampFresh(timestamp)) {
            return reply.code(400).send({ error: 'Request expired', code: 'EXPIRED' });
        }
        const normalizedWallet = walletAddress.toLowerCase();
        const normalizedSmartAccount = smartAccountAddress ? smartAccountAddress.toLowerCase() : null;
        const message = buildLoginMessage(timestamp);
        if (!(0, auth_1.verifyEvmPersonalSignature)(normalizedWallet, message, signature)) {
            return reply.code(401).send({ error: 'Invalid wallet signature', code: 'INVALID_SIGNATURE' });
        }
        const existingUser = await prisma_1.prisma.user.findUnique({
            where: { primaryWalletAddress: normalizedWallet },
        });
        if (normalizedSmartAccount &&
            existingUser?.smartAccountAddress &&
            existingUser.smartAccountAddress !== normalizedSmartAccount) {
            return reply.code(409).send({ error: 'Smart account mismatch for wallet', code: 'SMART_ACCOUNT_MISMATCH' });
        }
        const user = await prisma_1.prisma.user.upsert({
            where: { primaryWalletAddress: normalizedWallet },
            update: {
                ...(email && { email }),
                ...(email && { authType: 'email' }),
                ...(email && { embeddedSignerAddress: normalizedWallet }),
                ...(normalizedSmartAccount && { smartAccountAddress: normalizedSmartAccount }),
            },
            create: {
                primaryWalletAddress: normalizedWallet,
                authType: email ? 'email' : 'wallet',
                ...(email && { email }),
                ...(email && { embeddedSignerAddress: normalizedWallet }),
                ...(normalizedSmartAccount && { smartAccountAddress: normalizedSmartAccount }),
                wallets: {
                    create: [
                        {
                            walletAddress: normalizedWallet,
                            walletType: 'external',
                        },
                        ...(normalizedSmartAccount ? [{
                                walletAddress: normalizedSmartAccount,
                                walletType: 'pimlico_smart_account'
                            }] : [])
                    ],
                },
            },
        });
        return reply.send(publicUser(user, normalizedWallet));
    });
    fastify.post('/api/auth/email/request-otp', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (req, reply) => {
        const parsed = RequestEmailBody.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid email', code: 'INVALID_BODY' });
        }
        const email = parsed.data.email.toLowerCase();
        const code = generateOtp();
        await prisma_1.prisma.loginOtp.create({
            data: {
                email,
                codeHash: hashCode(email, code),
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
        });
        // Production should send via an email provider. Development returns the code for local testing.
        return reply.send({
            ok: true,
            delivery: process.env.NODE_ENV === 'production' ? 'email' : 'dev_response',
            devCode: process.env.NODE_ENV === 'production' ? undefined : code,
        });
    });
    fastify.post('/api/auth/email/verify-otp', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req, reply) => {
        const parsed = VerifyEmailBody.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
        }
        const email = parsed.data.email.toLowerCase();
        const otp = await prisma_1.prisma.loginOtp.findFirst({
            where: {
                email,
                consumed: false,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!otp || otp.codeHash !== hashCode(email, parsed.data.code)) {
            return reply.code(401).send({ error: 'Invalid or expired login code', code: 'INVALID_OTP' });
        }
        const existingUser = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!existingUser?.primaryWalletAddress) {
            return reply.code(409).send({
                error: 'Email account must first sign in with the embedded wallet',
                code: 'EMBEDDED_WALLET_REQUIRED',
            });
        }
        const user = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.loginOtp.update({ where: { id: otp.id }, data: { consumed: true } });
            return tx.user.update({
                where: { email },
                data: { emailVerifiedAt: new Date(), authType: 'email' },
            });
        });
        return reply.send(publicUser(user, user.primaryWalletAddress));
    });
    // ── POST /api/auth/logout ─────────────────────────────────────────────────
    // Stateless — the client simply drops the JWT from storage.
    fastify.post('/api/auth/logout', async (_req, reply) => {
        return reply.send({ ok: true });
    });
    // ── GET /api/auth/me ──────────────────────────────────────────────────────
    fastify.get('/api/auth/me', async (req, reply) => {
        const session = (0, jwt_1.authenticateSession)(req.headers.authorization);
        if (!session?.wallet) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        return reply.send({
            wallet: session.wallet,
            userId: session.userId,
            email: session.email,
            authType: session.authType ?? 'wallet',
            pimlico: (0, bsc_1.pimlicoConfig)(),
        });
    });
    fastify.get('/api/users/me', async (req, reply) => {
        const session = (0, jwt_1.authenticateSession)(req.headers.authorization);
        if (!session?.wallet) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        const user = session.userId
            ? await prisma_1.prisma.user.findUnique({ where: { id: session.userId } })
            : null;
        return reply.send({
            userId: user?.id ?? session.userId ?? null,
            email: user?.email ?? session.email ?? null,
            wallet: user?.primaryWalletAddress ?? session.wallet,
            embeddedSignerAddress: user?.embeddedSignerAddress ?? null,
            smartAccountAddress: user?.smartAccountAddress ?? null,
            authType: user?.authType ?? session.authType ?? 'wallet',
            pimlico: (0, bsc_1.pimlicoConfig)(),
        });
    });
    fastify.get('/api/pimlico/config', async (_req, reply) => {
        return reply.send((0, bsc_1.pimlicoConfig)());
    });
}
//# sourceMappingURL=auth.js.map