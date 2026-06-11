import type { FastifyInstance } from 'fastify';
import { withTenant } from '../db/withTenant.js';
import { opsSummary, statutoryPpmCompliance } from '../domain/dashboards.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/dashboard/ops', async (req, reply) => {
    const data = await withTenant(req.auth.tenantId, async (c) => ({
      ...(await opsSummary(c, req.auth.tenantId)),
      statutoryPpmCompliancePct: await statutoryPpmCompliance(c, req.auth.tenantId),
    }));
    return reply.send(data);
  });
}
