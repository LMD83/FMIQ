import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { acknowledge } from '../domain/notifications.js';

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/notifications', async (req, reply) => {
    const notifications = await withTenant(req.auth.tenantId, async (c) => {
      const { rows } = await c.query(
        `SELECT id, subject, body, priority, entity_type, entity_id, sent_at, read_at
           FROM ntf_message
          WHERE recipient_id = $1 OR recipient_id IS NULL
          ORDER BY sent_at DESC LIMIT 100`,
        [req.auth.userId],
      );
      return rows;
    });
    return reply.send({ notifications });
  });

  const ackSchema = z.object({ actionTaken: z.string().nullish() });
  app.post('/api/v1/notifications/:id/ack', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = ackSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' });
    const ok = await withTenant(req.auth.tenantId, (c) => acknowledge(c, req.auth.tenantId, id, { confirmedBy: req.auth.userId, actionTaken: parsed.data.actionTaken }));
    return reply.send({ acknowledged: ok });
  });
}
