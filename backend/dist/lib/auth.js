"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEvmAddress = isEvmAddress;
exports.recoverEvmAddress = recoverEvmAddress;
exports.verifyEvmPersonalSignature = verifyEvmPersonalSignature;
const secp256k1_1 = require("@noble/curves/secp256k1");
const sha3_1 = require("@noble/hashes/sha3");
const utils_1 = require("@noble/hashes/utils");
function isEvmAddress(value) {
    return /^0x[a-fA-F0-9]{40}$/.test(value);
}
function normalizeSignature(signature) {
    if (!/^0x[a-fA-F0-9]{130}$/.test(signature))
        return null;
    const bytes = (0, utils_1.hexToBytes)(signature.slice(2));
    const recoveryRaw = bytes[64];
    const recovery = recoveryRaw >= 27 ? recoveryRaw - 27 : recoveryRaw;
    if (recovery !== 0 && recovery !== 1)
        return null;
    return {
        compact: bytes.slice(0, 64),
        recovery,
    };
}
function ethereumMessageHash(message) {
    const messageBytes = (0, utils_1.utf8ToBytes)(message);
    const prefix = (0, utils_1.utf8ToBytes)(`\x19Ethereum Signed Message:\n${messageBytes.length}`);
    return (0, sha3_1.keccak_256)((0, utils_1.concatBytes)(prefix, messageBytes));
}
function recoverEvmAddress(message, signature) {
    try {
        const normalized = normalizeSignature(signature);
        if (!normalized)
            return null;
        // Correct usage of @noble/curves/secp256k1 v1.x API
        const recovered = secp256k1_1.secp256k1.Signature.fromCompact(normalized.compact)
            .addRecoveryBit(normalized.recovery)
            .recoverPublicKey(ethereumMessageHash(message))
            .toRawBytes(false); // false = uncompressed
        const uncompressed = recovered.length === 65 ? recovered.slice(1) : recovered;
        const address = (0, sha3_1.keccak_256)(uncompressed).slice(-20);
        return `0x${Buffer.from(address).toString('hex')}`;
    }
    catch (err) {
        console.error('Signature recovery failed:', err);
        return null;
    }
}
function verifyEvmPersonalSignature(walletAddress, message, signature) {
    const recovered = recoverEvmAddress(message, signature);
    return Boolean(recovered && recovered.toLowerCase() === walletAddress.toLowerCase());
}
//# sourceMappingURL=auth.js.map