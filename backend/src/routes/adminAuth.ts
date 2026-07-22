import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import {
  ADMIN_ROLES,
  createAdminSession,
  hashAdminPassword,
  hashToken,
  authenticateAdmin,
  verifyAdminPassword,
  writeAdminAudit,
} from '../lib/adminAuth';

const Credentials = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(200),
});

const BootstrapBody = Credentials.extend({
  displayName: z.string().trim().min(2).max(80),
  role: z.enum(ADMIN_ROLES).default('super_admin'),
});

function publicAdmin(admin: { id: string; email: string; displayName: string; role: string; status: string }) {
  return { id: admin.id, email: admin.email, displayName: admin.displayName, role: admin.role, status: admin.status };
}

export async function adminAuthRoutes(app: FastifyInstance) {
  app.post('/api/admin/auth/bootstrap', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const setupSecret = process.env.ADMIN_SETUP_SECRET ?? process.env.ADMIN_SECRET;
    if (!setupSecret || request.headers['x-admin-setup-secret'] !== setupSecret) return reply.code(403).send({ error: 'Forbidden' });
    if (await prisma.adminUser.count() > 0) return reply.code(409).send({ error: 'Admin bootstrap already completed', code: 'ALREADY_BOOTSTRAPPED' });
    const parsed = BootstrapBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid admin account' });
    const admin = await prisma.adminUser.create({
      data: { email: parsed.data.email.toLowerCase(), passwordHash: hashAdminPassword(parsed.data.password), displayName: parsed.data.displayName, role: parsed.data.role },
    });
    await writeAdminAudit({ adminUserId: admin.id, action: 'admin.bootstrap', targetType: 'admin_user', targetId: admin.id, ipAddress: request.ip });
    return reply.code(201).send({ admin: publicAdmin(admin) });
  });

  app.post('/api/admin/auth/login', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const parsed = Credentials.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid credentials' });
    const admin = await prisma.adminUser.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!admin || admin.status !== 'active' || !verifyAdminPassword(parsed.data.password, admin.passwordHash)) {
      return reply.code(401).send({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }
    const token = await createAdminSession(admin.id);
    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    await writeAdminAudit({ adminUserId: admin.id, action: 'admin.login', targetType: 'admin_user', targetId: admin.id, ipAddress: request.ip });
    return reply.send({ token, expiresIn: 8 * 60 * 60, admin: publicAdmin(admin) });
  });

  app.get('/api/admin/auth/me', async (request, reply) => {
    const admin = await authenticateAdmin(request);
    if (!admin) return reply.code(401).send({ error: 'Unauthorized' });
    return reply.send({ admin: publicAdmin(admin) });
  });

  app.post('/api/admin/auth/logout', async (request, reply) => {
    const admin = await authenticateAdmin(request);
    if (!admin) return reply.code(401).send({ error: 'Unauthorized' });
    const header = request.headers.authorization ?? '';
    const token = header.slice(7).trim();
    await prisma.adminSession.updateMany({ where: { adminUserId: admin.id, tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAdminAudit({ adminUserId: admin.id, action: 'admin.logout', targetType: 'admin_user', targetId: admin.id, ipAddress: request.ip });
    return reply.send({ ok: true });
  });
}
