import crypto from 'crypto';
import type { FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/prisma';

export const ADMIN_ROLES = ['super_admin', 'finance_admin', 'token_admin', 'moderation_admin', 'support_admin', 'viewer'] as const;
export type AdminRole = typeof ADMIN_ROLES[number];

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET ?? process.env.JWT_SECRET;
const ADMIN_TOKEN_TTL_SECONDS = 8 * 60 * 60;

interface AdminTokenPayload {
  admin: true;
  adminId: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

function passwordHash(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function hashAdminPassword(password: string) {
  return passwordHash(password);
}

export function verifyAdminPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createAdminSession(adminUserId: string) {
  if (!ADMIN_JWT_SECRET) throw new Error('Admin JWT secret is not configured');
  const sessionId = crypto.randomUUID();
  const token = jwt.sign({ admin: true, adminId: adminUserId, sessionId }, ADMIN_JWT_SECRET, { expiresIn: ADMIN_TOKEN_TTL_SECONDS });
  await prisma.adminSession.create({
    data: {
      id: sessionId,
      adminUserId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ADMIN_TOKEN_TTL_SECONDS * 1000),
    },
  });
  return token;
}

export async function authenticateAdmin(request: FastifyRequest) {
  if (!ADMIN_JWT_SECRET) return null;
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET) as AdminTokenPayload;
    if (payload.admin !== true || !payload.adminId || !payload.sessionId) return null;
    const session = await prisma.adminSession.findUnique({
      where: { id: payload.sessionId },
      include: { adminUser: true },
    });
    if (!session || session.tokenHash !== hashToken(token) || session.revokedAt || session.expiresAt <= new Date()) return null;
    if (session.adminUser.status !== 'active' || session.adminUser.id !== payload.adminId) return null;
    return session.adminUser;
  } catch {
    return null;
  }
}

export async function requireAdmin(request: FastifyRequest, roles?: readonly AdminRole[]) {
  const admin = await authenticateAdmin(request);
  if (!admin) return null;
  if (roles && !roles.includes(admin.role as AdminRole) && admin.role !== 'super_admin') return null;
  return admin;
}

export async function writeAdminAudit(params: {
  adminUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
  metadata?: unknown;
  ipAddress?: string;
}) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: params.adminUserId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      reason: params.reason,
      metadata: params.metadata as object | undefined,
      ipAddress: params.ipAddress,
    },
  });
}

export { hashToken };
