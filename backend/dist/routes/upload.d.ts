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
export declare function uploadRoutes(app: FastifyInstance): Promise<void>;
//# sourceMappingURL=upload.d.ts.map