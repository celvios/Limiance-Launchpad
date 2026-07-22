import type { FastifyRequest } from 'fastify';
export declare const ADMIN_ROLES: readonly ["super_admin", "finance_admin", "token_admin", "moderation_admin", "support_admin", "viewer"];
export type AdminRole = typeof ADMIN_ROLES[number];
export declare function hashAdminPassword(password: string): string;
export declare function verifyAdminPassword(password: string, stored: string): boolean;
declare function hashToken(token: string): string;
export declare function createAdminSession(adminUserId: string): Promise<string>;
export declare function authenticateAdmin(request: FastifyRequest): Promise<{
    email: string;
    id: string;
    createdAt: Date;
    passwordHash: string;
    displayName: string;
    role: string;
    status: string;
    lastLoginAt: Date | null;
    updatedAt: Date;
} | null>;
export declare function requireAdmin(request: FastifyRequest, roles?: readonly AdminRole[]): Promise<{
    email: string;
    id: string;
    createdAt: Date;
    passwordHash: string;
    displayName: string;
    role: string;
    status: string;
    lastLoginAt: Date | null;
    updatedAt: Date;
} | null>;
export declare function writeAdminAudit(params: {
    adminUserId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    reason?: string;
    metadata?: unknown;
    ipAddress?: string;
}): Promise<void>;
export { hashToken };
//# sourceMappingURL=adminAuth.d.ts.map