"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRoutes = uploadRoutes;
const form_data_1 = __importDefault(require("form-data"));
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const PINATA_API_KEY = process.env.PINATA_API_KEY ?? '';
const PINATA_SECRET = process.env.PINATA_SECRET_API_KEY ?? '';
const PINATA_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
async function uploadRoutes(app) {
    app.post('/api/upload', async (req, reply) => {
        const parts = req.parts();
        let fileBuffer = null;
        let mimeType = '';
        let filename = 'upload';
        for await (const part of parts) {
            if (part.type === 'file' && part.fieldname === 'file') {
                mimeType = part.mimetype;
                filename = part.filename ?? 'upload';
                const chunks = [];
                let size = 0;
                for await (const chunk of part.file) {
                    size += chunk.length;
                    if (size > MAX_FILE_SIZE) {
                        return reply.code(400).send({ error: 'File too large (max 5MB)', code: 'FILE_TOO_LARGE' });
                    }
                    chunks.push(chunk);
                }
                fileBuffer = Buffer.concat(chunks);
            }
        }
        if (!fileBuffer) {
            return reply.code(400).send({ error: 'No file provided', code: 'NO_FILE' });
        }
        if (!ALLOWED_TYPES.includes(mimeType)) {
            return reply.code(400).send({
                error: `Invalid file type: ${mimeType}. Allowed: jpeg, png, gif, webp`,
                code: 'INVALID_FILE_TYPE',
            });
        }
        // Upload to Pinata
        const form = new form_data_1.default();
        form.append('file', fileBuffer, { filename, contentType: mimeType });
        const pinataMetadata = JSON.stringify({ name: filename });
        form.append('pinataMetadata', pinataMetadata);
        const pinataOptions = JSON.stringify({ cidVersion: 1 });
        form.append('pinataOptions', pinataOptions);
        let ipfsHash;
        try {
            const resp = await fetch(PINATA_URL, {
                method: 'POST',
                headers: {
                    pinata_api_key: PINATA_API_KEY,
                    pinata_secret_api_key: PINATA_SECRET,
                    ...form.getHeaders(),
                },
                body: form,
            });
            if (!resp.ok) {
                const body = await resp.text();
                console.error('[upload] Pinata error:', body);
                return reply.code(502).send({ error: 'Upload failed', code: 'UPLOAD_FAILED' });
            }
            const data = await resp.json();
            ipfsHash = data.IpfsHash;
        }
        catch (err) {
            console.error('[upload] Pinata request failed:', err);
            return reply.code(502).send({ error: 'Upload service unavailable', code: 'UPLOAD_FAILED' });
        }
        return reply.send({ uri: `ipfs://${ipfsHash}` });
    });
}
//# sourceMappingURL=upload.js.map