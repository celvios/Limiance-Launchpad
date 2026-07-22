"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuthRoutes = adminAuthRoutes;
const zod_1 = require("zod");
const prisma_1 = require("../services/prisma");
const adminAuth_1 = require("../lib/adminAuth");
const Credentials = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(12).max(200),
});
const BootstrapBody = Credentials.extend({
    displayName: zod_1.z.string().trim().min(2).max(80),
    role: zod_1.z.enum(adminAuth_1.ADMIN_ROLES).default('super_admin'),
});
function publicAdmin(admin) {
    return { id: admin.id, email: admin.email, displayName: admin.displayName, role: admin.role, status: admin.status };
}
async function adminAuthRoutes(app) {
    app.post('/api/admin/auth/bootstrap', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (request, reply) => {
        const setupSecret = process.env.ADMIN_SETUP_SECRET ?? process.env.ADMIN_SECRET;
        if (!setupSecret || request.headers['x-admin-setup-secret'] !== setupSecret)
            return reply.code(403).send({ error: 'Forbidden' });
        if (await prisma_1.prisma.adminUser.count() > 0)
            return reply.code(409).send({ error: 'Admin bootstrap already completed', code: 'ALREADY_BOOTSTRAPPED' });
        const parsed = BootstrapBody.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid admin account' });
        const admin = await prisma_1.prisma.adminUser.create({
            data: { email: parsed.data.email.toLowerCase(), passwordHash: (0, adminAuth_1.hashAdminPassword)(parsed.data.password), displayName: parsed.data.displayName, role: parsed.data.role },
        });
        await (0, adminAuth_1.writeAdminAudit)({ adminUserId: admin.id, action: 'admin.bootstrap', targetType: 'admin_user', targetId: admin.id, ipAddress: request.ip });
        return reply.code(201).send({ admin: publicAdmin(admin) });
    });
    app.post('/api/admin/auth/login', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (request, reply) => {
        const parsed = Credentials.safeParse(request.body);
        if (!parsed.success)
            return reply.code(400).send({ error: 'Invalid credentials' });
        const admin = await prisma_1.prisma.adminUser.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!admin || admin.status !== 'active' || !(0, adminAuth_1.verifyAdminPassword)(parsed.data.password, admin.passwordHash)) {
            return reply.code(401).send({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
        }
        const token = await (0, adminAuth_1.createAdminSession)(admin.id);
        await prisma_1.prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
        await (0, adminAuth_1.writeAdminAudit)({ adminUserId: admin.id, action: 'admin.login', targetType: 'admin_user', targetId: admin.id, ipAddress: request.ip });
        return reply.send({ token, expiresIn: 8 * 60 * 60, admin: publicAdmin(admin) });
    });
    app.get('/api/admin/auth/me', async (request, reply) => {
        const admin = await (0, adminAuth_1.authenticateAdmin)(request);
        if (!admin)
            return reply.code(401).send({ error: 'Unauthorized' });
        return reply.send({ admin: publicAdmin(admin) });
    });
    app.post('/api/admin/auth/logout', async (request, reply) => {
        const admin = await (0, adminAuth_1.authenticateAdmin)(request);
        if (!admin)
            return reply.code(401).send({ error: 'Unauthorized' });
        const header = request.headers.authorization ?? '';
        const token = header.slice(7).trim();
        await prisma_1.prisma.adminSession.updateMany({ where: { adminUserId: admin.id, tokenHash: (0, adminAuth_1.hashToken)(token), revokedAt: null }, data: { revokedAt: new Date() } });
        await (0, adminAuth_1.writeAdminAudit)({ adminUserId: admin.id, action: 'admin.logout', targetType: 'admin_user', targetId: admin.id, ipAddress: request.ip });
        return reply.send({ ok: true });
    });
}
//# sourceMappingURL=adminAuth.js.map