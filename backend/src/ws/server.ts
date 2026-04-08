/**
 * WebSocket broadcast server.
 *
 * Runs on WS_PORT (default 4001), separate from the Fastify HTTP server.
 * Clients subscribe with no authentication — all events are public.
 *
 * Messages are JSON strings matching TradeEvent | GraduationEvent from CLAUDE_AGENT.md.
 */
import WebSocket, { WebSocketServer } from 'ws';

const WS_PORT = parseInt(process.env.WS_PORT ?? '4001', 10);

const wss = new WebSocketServer({ port: WS_PORT });
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

wss.on('listening', () => {
  console.log(`WebSocket server running on ws://0.0.0.0:${WS_PORT}`);
});

/**
 * Broadcast a JSON-serializable message to all connected clients.
 * Clients that are not OPEN are silently skipped and removed.
 */
export function broadcast(message: object): void {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    } else {
      clients.delete(client);
    }
  }
}

export { wss };
