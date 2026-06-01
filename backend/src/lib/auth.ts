import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { concatBytes, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';

export function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function normalizeSignature(signature: string): { compact: Uint8Array; recovery: number } | null {
  if (!/^0x[a-fA-F0-9]{130}$/.test(signature)) return null;
  const bytes = hexToBytes(signature.slice(2));
  const recoveryRaw = bytes[64];
  const recovery = recoveryRaw >= 27 ? recoveryRaw - 27 : recoveryRaw;
  if (recovery !== 0 && recovery !== 1) return null;
  return {
    compact: bytes.slice(0, 64),
    recovery,
  };
}

function ethereumMessageHash(message: string): Uint8Array {
  const messageBytes = utf8ToBytes(message);
  const prefix = utf8ToBytes(`\x19Ethereum Signed Message:\n${messageBytes.length}`);
  return keccak_256(concatBytes(prefix, messageBytes));
}

export function recoverEvmAddress(message: string, signature: string): string | null {
  try {
    const normalized = normalizeSignature(signature);
    if (!normalized) return null;
    const recovered = (secp256k1 as any).recoverPublicKey(
      new Uint8Array([normalized.recovery, ...normalized.compact]),
      ethereumMessageHash(message),
    );
    const uncompressed = recovered.length === 65 ? recovered.slice(1) : recovered;
    const address = keccak_256(uncompressed).slice(-20);
    return `0x${Buffer.from(address).toString('hex')}`;
  } catch {
    return null;
  }
}

export function verifyEvmPersonalSignature(walletAddress: string, message: string, signature: string): boolean {
  const recovered = recoverEvmAddress(message, signature);
  return Boolean(recovered && recovered.toLowerCase() === walletAddress.toLowerCase());
}
