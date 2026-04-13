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

const clients = new Set<WebSocket>();

export function addClient(ws: WebSocket): void {
  clients.add(ws);
}

export function removeClient(ws: WebSocket): void {
  clients.delete(ws);
}

/**
 * Broadcast a JSON-serialisable message to all connected clients.
 * Clients that are no longer OPEN are pruned automatically.
 */
export function broadcast(message: object): void {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(payload);
    } else {
      clients.delete(client);
    }
  }
}
