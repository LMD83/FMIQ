import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import { nextRef } from '../domain/workOrders.js';
import { assetHealth, failurePredictions } from '../domain/predictive.js';
import { compareToCohort, tenantKpis } from '../domain/benchmarking.js';
import { resolveTriageGateway } from '../adapters/resolve.js';

/**
 * Phase-3 intelligence endpoints: AI fault triage (human-in-the-loop WO creation),
 * predictive-maintenance risk, and anonymised benchmarking.
 */
export async function intelligenceRoutes(app: FastifyInstance): Promise<void> {
  // Plain-language fault report → triaged draft. Optionally raise the WO (the human acts).
  const triageSchema = z.object({ report: z.string().min(1), spaceId: z.string().uuid().nullish(), createWorkOrder: z.boolean().optional() });
  app.post('/api/v1/triage', async (req, reply) => {
    const p = triageSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const triage = await resolveTriageGateway().triage(p.data.report);

    let workOrderRef: string | undefined;
    if (p.data.createWorkOrder) {
      workOrderRef = await withTenant(req.auth.tenantId, async (c) => {
        const ref = await nextRef(c, req.auth.tenantId);
        await c.query(
          `INSERT INTO wo_work_order (tenant_id, ref, space_id, source, priority, status, title, conservation_notes)
           VALUES ($1,$2,$3,'reactive',$4,'open',$5,$6)`,
          [req.auth.tenantId, ref, p.data.spaceId ?? null, triage.priority, `${triage.category}: ${triage.summary}`, p.data.report],
        );
        return ref;
      });
    }
    return reply.send({ triage, workOrderRef });
  });

  // Predicted-failure leaderboard + per-asset health.
  app.get('/api/v1/predictive/failures', async (req, reply) => {
    const items = await withTenant(req.auth.tenantId, (c) => failurePredictions(c, req.auth.tenantId));
    return reply.send({ items });
  });
  app.get('/api/v1/predictive/assets/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const health = await withTenant(req.auth.tenantId, (c) => assetHealth(c, req.auth.tenantId, id));
    if (!health) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ health });
  });

  // Benchmark a tenant KPI against an anonymised cohort (cohort supplied by the analytics layer).
  const benchSchema = z.object({ metric: z.enum(['statutoryPpmPct', 'openWorkOrders', 'activeExcursions']), cohort: z.array(z.number()) });
  app.post('/api/v1/benchmark', { preHandler: requireRole('TenantAdmin', 'SystemAdmin', 'FacilitiesManager') }, async (req, reply) => {
    const p = benchSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const kpis = await withTenant(req.auth.tenantId, (c) => tenantKpis(c, req.auth.tenantId));
    return reply.send({ metric: p.data.metric, ...compareToCohort(kpis[p.data.metric], p.data.cohort) });
  });
}
