import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import { createSchedule, generateDueWorkOrders, proposeTemplates } from '../domain/ppm.js';

export async function ppmRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/ppm/schedules', async (req, reply) => {
    const schedules = await withTenant(req.auth.tenantId, async (c) => {
      const { rows } = await c.query(
        `SELECT s.id, s.asset_id, a.code AS asset_code, t.name AS task, s.frequency, s.next_due, s.classification, s.statutory_flag, s.active
           FROM wo_ppm_schedule s
           JOIN wo_task_template t ON t.id = s.task_template_id
           LEFT JOIN est_asset a ON a.id = s.asset_id
          ORDER BY s.next_due NULLS LAST LIMIT 500`,
      );
      return rows;
    });
    return reply.send({ schedules });
  });

  app.get('/api/v1/ppm/templates', async (req, reply) => {
    const q = z.object({ assetType: z.string().optional() }).safeParse(req.query);
    const templates = await withTenant(req.auth.tenantId, (c) => proposeTemplates(c, q.success ? q.data.assetType ?? null : null));
    return reply.send({ templates });
  });

  const createSchema = z.object({
    assetId: z.string().uuid(),
    taskTemplateId: z.string().uuid(),
    frequency: z.string().nullish(),
    leadDays: z.number().int().optional(),
    nextDue: z.string().nullish(),
  });
  app.post('/api/v1/ppm/schedules', { preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    const schedule = await withTenant(req.auth.tenantId, (c) => createSchedule(c, req.auth.tenantId, parsed.data));
    return reply.code(201).send({ schedule });
  });

  app.post('/api/v1/ppm/generate', { preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const generated = await withTenant(req.auth.tenantId, (c) => generateDueWorkOrders(c, req.auth.tenantId));
    return reply.send({ generated });
  });
}
