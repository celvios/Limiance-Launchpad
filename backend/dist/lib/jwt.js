"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
exports.extractBearer = extractBearer;
exports.authenticateRequest = authenticateRequest;
exports.authenticateSession = authenticateSession;
/**
 * JWT helpers for the EVM signed-message session system.
 *
 * Tokens are issued on POST /api/auth/login and must be sent as
 *   Authorization: Bearer <token>
 * on every authenticated route.
 */
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
const JWT_EXPIRY = '24h';
/**
 * Issue a signed JWT for the given wallet address.
 */
function signToken(wallet, extra = {}) {
    return jsonwebtoken_1.default.sign({ wallet, ...extra }, JWT_SECRET, {
        expiresIn: JWT_EXPIRY,
    });
}
/**
 * Verify a JWT and return the decoded payload, or null if invalid/expired.
 */
function verifyToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
}
/**
 * Extract a Bearer token from an Authorization header value.
 * Returns null if the header is missing or malformed.
 */
function extractBearer(authHeader) {
    if (!authHeader?.startsWith('Bearer '))
        return null;
    const token = authHeader.slice(7).trim();
    return token.length > 0 ? token : null;
}
/**
 * Authenticate a Fastify request by its Authorization header.
 * Returns the wallet address on success, or null on failure.
 */
function authenticateRequest(authHeader) {
    const token = extractBearer(authHeader);
    if (!token)
        return null;
    const payload = verifyToken(token);
    return payload?.wallet ?? null;
}
function authenticateSession(authHeader) {
    const token = extractBearer(authHeader);
    if (!token)
        return null;
    return verifyToken(token);
}
//# sourceMappingURL=jwt.js.map