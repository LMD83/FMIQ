import type { FastifyInstance } from 'fastify';
import { withTenant } from '../db/withTenant.js';
import { renderEvidenceHtml, workOrderEvidencePack } from '../domain/evidence.js';

export async function evidenceRoutes(app: FastifyInstance): Promise<void> {
  // Structured evidence pack (JSON) for a work order — the audit/HSA/loan bundle.
  app.get('/api/v1/evidence/work-order/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const pack = await withTenant(req.auth.tenantId, (c) => workOrderEvidencePack(c, id));
    return reply.send({ pack });
  });

  // One-click print-ready HTML rendering (browser → PDF; PDF/A via deployment renderer).
  app.get('/api/v1/evidence/work-order/:id.html', async (req, reply) => {
    const { id } = req.params as { id: string };
    const pack = await withTenant(req.auth.tenantId, (c) => workOrderEvidencePack(c, id));
    return reply.header('content-type', 'text/html; charset=utf-8').send(renderEvidenceHtml(pack));
  });
}
