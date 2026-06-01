/**
 * JWT helpers for the EVM signed-message session system.
 *
 * Tokens are issued on POST /api/auth/login and must be sent as
 *   Authorization: Bearer <token>
 * on every authenticated route.
 */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
const JWT_EXPIRY = '24h';

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
export function signToken(wallet: string, extra: Omit<SessionPayload, 'wallet' | 'iat' | 'exp'> = {}): string {
  return jwt.sign({ wallet, ...extra } satisfies Omit<SessionPayload, 'iat' | 'exp'>, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Verify a JWT and return the decoded payload, or null if invalid/expired.
 */
export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Extract a Bearer token from an Authorization header value.
 * Returns null if the header is missing or malformed.
 */
export function extractBearer(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Authenticate a Fastify request by its Authorization header.
 * Returns the wallet address on success, or null on failure.
 */
export function authenticateRequest(authHeader: string | undefined): string | null {
  const token = extractBearer(authHeader);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.wallet ?? null;
}

export function authenticateSession(authHeader: string | undefined): SessionPayload | null {
  const token = extractBearer(authHeader);
  if (!token) return null;
  return verifyToken(token);
}


