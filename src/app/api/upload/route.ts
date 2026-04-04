import { NextResponse } from 'next/server';
import { PinataSDK } from 'pinata-web3';

/* ── Pinata Upload API Route ──
 * Server-side only — keeps the JWT secret.
 * Accepts multipart/form-data with a single "file" field.
 * Returns { ipfsUri, gatewayUrl }.
 */

const PINATA_JWT = process.env.PINATA_JWT || '';
const GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud';

export async function POST(request: Request): Promise<NextResponse> {
  if (!PINATA_JWT) {
    return NextResponse.json(
      { error: 'PINATA_JWT not configured. Set it in .env.local' },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 });
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPG, PNG, GIF, WebP.' },
        { status: 400 }
      );
    }

    const pinata = new PinataSDK({ pinataJwt: PINATA_JWT });

    const upload = await pinata.upload.file(file);
    const cid = upload.IpfsHash;
    const ipfsUri = `ipfs://${cid}`;
    const gatewayUrl = `${GATEWAY}/ipfs/${cid}`;

    return NextResponse.json({ ipfsUri, gatewayUrl });
  } catch (err) {
    console.error('IPFS upload error:', err);
    return NextResponse.json(
      { error: 'Failed to upload to IPFS' },
      { status: 500 }
    );
  }
}
