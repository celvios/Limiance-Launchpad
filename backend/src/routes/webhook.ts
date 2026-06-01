import { FastifyInstance } from 'fastify';

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/webhook/bsc', async (_request, reply) => {
    return reply.send({ ok: true, message: 'BSC event webhooks are accepted; block indexer owns canonical ingestion.' });
  });
}
