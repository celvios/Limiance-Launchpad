/**
 * Wallet signature verification for authenticated endpoints.
 *
 * All authenticated actions require a signed message in this format:
 *   ACTION:[type]|DATA:[relevant_data]|TIMESTAMP:[unix_ms]
 *
 * Signatures are base64-encoded (Buffer.from(sig).toString('base64')).
 * Public keys are base58-encoded Solana wallet addresses.
 */
import nacl from 'tweetnacl';
import bs58 from 'bs58';

/**
 * Verify an ed25519 wallet signature.
 *
 * @param walletAddress  Base58 Solana public key
 * @param message        Plain-text message that was signed
 * @param signatureB64   Base64-encoded ed25519 signature
 * @returns true if the signature is valid, false otherwise
 */
export function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signatureB64: string
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Uint8Array.from(Buffer.from(signatureB64, 'base64'));
    const publicKeyBytes = bs58.decode(walletAddress);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Check that a client-supplied timestamp is within the acceptable window.
 * Rejects stale or future-dated requests to prevent replay attacks.
 *
 * @param timestamp  Unix milliseconds from the client
 * @param maxAgeMs   Maximum age allowed (default: 5 minutes)
 */
export function isTimestampFresh(
  timestamp: number,
  maxAgeMs: number = 5 * 60 * 1000
): boolean {
  return Math.abs(Date.now() - timestamp) <= maxAgeMs;
}
