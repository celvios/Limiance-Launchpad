"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookRoutes = webhookRoutes;
async function webhookRoutes(app) {
    app.post('/webhook/bsc', async (_request, reply) => {
        return reply.send({ ok: true, message: 'BSC event webhooks are accepted; block indexer owns canonical ingestion.' });
    });
}
//# sourceMappingURL=webhook.js.map