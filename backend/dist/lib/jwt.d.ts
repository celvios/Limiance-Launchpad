export interface SessionPayload {
    wallet: string;
    userId?: string;
    email?: string;
    authType?: 'wallet' | 'email';
    iat?: number;
    exp?: number;
}
/**
 * Issue a signed JWT for the given wallet address.
 */
export declare function signToken(wallet: string, extra?: Omit<SessionPayload, 'wallet' | 'iat' | 'exp'>): string;
/**
 * Verify a JWT and return the decoded payload, or null if invalid/expired.
 */
export declare function verifyToken(token: string): SessionPayload | null;
/**
 * Extract a Bearer token from an Authorization header value.
 * Returns null if the header is missing or malformed.
 */
export declare function extractBearer(authHeader: string | undefined): string | null;
/**
 * Authenticate a Fastify request by its Authorization header.
 * Returns the wallet address on success, or null on failure.
 */
export declare function authenticateRequest(authHeader: string | undefined): string | null;
export declare function authenticateSession(authHeader: string | undefined): SessionPayload | null;
//# sourceMappingURL=jwt.d.ts.map