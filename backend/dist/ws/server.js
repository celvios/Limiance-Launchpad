"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addClient = addClient;
exports.removeClient = removeClient;
exports.broadcast = broadcast;
const clients = new Set();
function addClient(ws) {
    clients.add(ws);
}
function removeClient(ws) {
    clients.delete(ws);
}
/**
 * Broadcast a JSON-serialisable message to all connected clients.
 * Clients that are no longer OPEN are pruned automatically.
 */
function broadcast(message) {
    const payload = JSON.stringify(message);
    for (const client of clients) {
        if (client.readyState === 1 /* OPEN */) {
            client.send(payload);
        }
        else {
            clients.delete(client);
        }
    }
}
//# sourceMappingURL=server.js.map