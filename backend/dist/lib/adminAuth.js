"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_ROLES = void 0;
exports.hashAdminPassword = hashAdminPassword;
exports.verifyAdminPassword = verifyAdminPassword;
exports.createAdminSession = createAdminSession;
exports.authenticateAdmin = authenticateAdmin;
exports.requireAdmin = requireAdmin;
exports.writeAdminAudit = writeAdminAudit;
exports.hashToken = hashToken;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../services/prisma");
exports.ADMIN_ROLES = ['super_admin', 'finance_admin', 'token_admin', 'moderation_admin', 'support_admin', 'viewer'];
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET ?? process.env.JWT_SECRET;
const ADMIN_TOKEN_TTL_SECONDS = 8 * 60 * 60;
function passwordHash(password, salt = crypto_1.default.randomBytes(16).toString('hex')) {
    const derived = crypto_1.default.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
}
function hashAdminPassword(password) {
    return passwordHash(password);
}
function verifyAdminPassword(password, stored) {
    const [salt, expected] = stored.split(':');
    if (!salt || !expected)
        return false;
    const actual = crypto_1.default.scryptSync(password, salt, 64).toString('hex');
    return actual.length === expected.length && crypto_1.default.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
function hashToken(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
}
async function createAdminSession(adminUserId) {
    if (!ADMIN_JWT_SECRET)
        throw new Error('Admin JWT secret is not configured');
    const sessionId = crypto_1.default.randomUUID();
    const token = jsonwebtoken_1.default.sign({ admin: true, adminId: adminUserId, sessionId }, ADMIN_JWT_SECRET, { expiresIn: ADMIN_TOKEN_TTL_SECONDS });
    await prisma_1.prisma.adminSession.create({
        data: {
            id: sessionId,
            adminUserId,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + ADMIN_TOKEN_TTL_SECONDS * 1000),
        },
    });
    return token;
}
async function authenticateAdmin(request) {
    if (!ADMIN_JWT_SECRET)
        return null;
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer '))
        return null;
    const token = header.slice(7).trim();
    try {
        const payload = jsonwebtoken_1.default.verify(token, ADMIN_JWT_SECRET);
        if (payload.admin !== true || !payload.adminId || !payload.sessionId)
            return null;
        const session = await prisma_1.prisma.adminSession.findUnique({
            where: { id: payload.sessionId },
            include: { adminUser: true },
        });
        if (!session || session.tokenHash !== hashToken(token) || session.revokedAt || session.expiresAt <= new Date())
            return null;
        if (session.adminUser.status !== 'active' || session.adminUser.id !== payload.adminId)
            return null;
        return session.adminUser;
    }
    catch {
        return null;
    }
}
async function requireAdmin(request, roles) {
    const admin = await authenticateAdmin(request);
    if (!admin)
        return null;
    if (roles && !roles.includes(admin.role) && admin.role !== 'super_admin')
        return null;
    return admin;
}
async function writeAdminAudit(params) {
    await prisma_1.prisma.adminAuditLog.create({
        data: {
            adminUserId: params.adminUserId,
            action: params.action,
            targetType: params.targetType,
            targetId: params.targetId,
            reason: params.reason,
            metadata: params.metadata,
            ipAddress: params.ipAddress,
        },
    });
}
//# sourceMappingURL=adminAuth.js.map