/* ── Pinata IPFS Upload ──
 * Uploads token images to IPFS via Pinata.
 * Requires PINATA_JWT in environment (server-side only).
 * The Next.js API route at /api/upload proxies this for the client.
 */

/**
 * Upload a file to Pinata IPFS via the Next.js API route.
 * Returns the IPFS URI (ipfs://CID) on success.
 */
export async function uploadToIPFS(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error((error as { error: string }).error || 'Upload failed');
  }

  const data = (await res.json()) as { ipfsUri: string; gatewayUrl: string };
  return data.ipfsUri;
}
