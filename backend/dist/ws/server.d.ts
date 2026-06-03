/**
 * WebSocket client registry and broadcast utility.
 *
 * The actual WebSocket server is registered as a Fastify route at GET /ws
 * using @fastify/websocket (see index.ts). This module only manages the
 * connected client set so that any route (webhook, etc.) can broadcast.
 *
 * This design works on single-port hosts like Render where only one TCP port
 * is exposed per service.
 */
import type { WebSocket } from 'ws';
export declare function addClient(ws: WebSocket): void;
export declare function removeClient(ws: WebSocket): void;
/**
 * Broadcast a JSON-serialisable message to all connected clients.
 * Clients that are no longer OPEN are pruned automatically.
 */
export declare function broadcast(message: object): void;
//# sourceMappingURL=server.d.ts.map