import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import { parseFirePanelEvent } from '../adapters/firePanel.js';
import { parseEmergencyLightingTest } from '../adapters/emergencyLighting.js';
import { parseAxiellObjects } from '../adapters/axiell.js';
import { ingestEmergencyLightingTest, ingestFirePanelEvent } from '../domain/lifeSafety.js';
import { syncObjectsForZone } from '../domain/cms.js';
import { verifyAndRecord } from '../domain/taxClearance.js';
import { resolveTaxClearanceGateway } from '../adapters/resolve.js';

export async function integrationRoutes(app: FastifyInstance): Promise<void> {
  // Fire-alarm panel events (I.S. 3218) — fault auto-raises a WO.
  app.post('/api/v1/integrations/fire-panel/webhook', async (req, reply) => {
    let event;
    try {
      event = parseFirePanelEvent(req.body);
    } catch (e) {
      return reply.code(400).send({ error: 'unparseable_payload', detail: (e as Error).message });
    }
    const spaceId = (req.body as { spaceId?: string }).spaceId ?? null;
    const result = await withTenant(req.auth.tenantId, (c) => ingestFirePanelEvent(c, req.auth.tenantId, event, spaceId));
    return reply.send(result);
  });

  // Emergency-lighting self-test (I.S. 3217) — a failed luminaire raises a remedial WO.
  app.post('/api/v1/integrations/emergency-lighting/test', async (req, reply) => {
    let test;
    try {
      test = parseEmergencyLightingTest(req.body);
    } catch (e) {
      return reply.code(400).send({ error: 'unparseable_payload', detail: (e as Error).message });
    }
    const spaceId = (req.body as { spaceId?: string }).spaceId ?? null;
    const result = await withTenant(req.auth.tenantId, (c) => ingestEmergencyLightingTest(c, req.auth.tenantId, test, spaceId));
    return reply.send(result);
  });

  // Axiell CMS sync (read-only, data-minimised) into a zone's object links.
  const cmsSchema = z.object({ zoneId: z.string().uuid(), records: z.array(z.unknown()) });
  app.post('/api/v1/integrations/cms/axiell/sync', { preHandler: requireRole('ConservationOfficer', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const parsed = cmsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    let objects;
    try {
      objects = parseAxiellObjects({ records: parsed.data.records });
    } catch (e) {
      return reply.code(400).send({ error: 'unparseable_payload', detail: (e as Error).message });
    }
    const result = await withTenant(req.auth.tenantId, (c) => syncObjectsForZone(c, req.auth.tenantId, parsed.data.zoneId, 'axiell', objects));
    return reply.send(result);
  });

  // Re-check a contractor's Revenue tax clearance (deferred gateway → 'unknown' until wired).
  app.post('/api/v1/contractors/:id/tax-clearance/recheck', { preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const status = await withTenant(req.auth.tenantId, (c) => verifyAndRecord(c, req.auth.tenantId, id, resolveTaxClearanceGateway()));
    return reply.send({ contractorId: id, status });
  });
}
