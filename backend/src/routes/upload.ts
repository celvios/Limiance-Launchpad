/**
 * IPFS image upload proxy — hides Pinata API key from the frontend.
 *
 * POST /api/upload
 *   Content-Type: multipart/form-data
 *   Body: { file: File }
 *
 * Response: { uri: "ipfs://Qm..." }
 */
import { FastifyInstance } from 'fastify';
import FormData from 'form-data';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const PINATA_API_KEY = process.env.PINATA_API_KEY ?? '';
const PINATA_SECRET = process.env.PINATA_SECRET_API_KEY ?? '';
const PINATA_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

export async function uploadRoutes(app: FastifyInstance) {
  app.post('/api/upload', async (req, reply) => {
    const parts = req.parts();

    let fileBuffer: Buffer | null = null;
    let mimeType = '';
    let filename = 'upload';

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        mimeType = part.mimetype;
        filename = part.filename ?? 'upload';

        const chunks: Buffer[] = [];
        let size = 0;

        for await (const chunk of part.file) {
          size += chunk.length;
          if (size > MAX_FILE_SIZE) {
            return reply.code(400).send({ error: 'File too large (max 5MB)', code: 'FILE_TOO_LARGE' });
          }
          chunks.push(chunk as Buffer);
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
    const form = new FormData();
    form.append('file', fileBuffer, { filename, contentType: mimeType });

    const pinataMetadata = JSON.stringify({ name: filename });
    form.append('pinataMetadata', pinataMetadata);

    const pinataOptions = JSON.stringify({ cidVersion: 1 });
    form.append('pinataOptions', pinataOptions);

    let ipfsHash: string;
    try {
      const resp = await fetch(PINATA_URL, {
        method: 'POST',
        headers: {
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET,
          ...form.getHeaders(),
        },
        body: form as any,
      });

      if (!resp.ok) {
        const body = await resp.text();
        console.error('[upload] Pinata error:', body);
        return reply.code(502).send({ error: 'Upload failed', code: 'UPLOAD_FAILED' });
      }

      const data = await resp.json() as { IpfsHash: string };
      ipfsHash = data.IpfsHash;
    } catch (err) {
      console.error('[upload] Pinata request failed:', err);
      return reply.code(502).send({ error: 'Upload service unavailable', code: 'UPLOAD_FAILED' });
    }

    return reply.send({ uri: `ipfs://${ipfsHash}` });
  });
}
