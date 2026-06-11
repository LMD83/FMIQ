import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import { addCert, createHandover, goLive, handoverGateStatus, importCobie, HandoverError } from '../domain/handover.js';
import { parseCobie } from '../adapters/cobie.js';

export async function handoverRoutes(app: FastifyInstance): Promise<void> {
  const createSchema = z.object({ projectId: z.string().uuid().nullish(), buildingId: z.string().uuid().nullish() });
  app.post('/api/v1/handovers', { preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const p = createSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const handover = await withTenant(req.auth.tenantId, (c) => createHandover(c, req.auth.tenantId, p.data));
    return reply.code(201).send({ handover });
  });

  app.get('/api/v1/handovers/:id/gate', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const gate = await withTenant(req.auth.tenantId, (c) => handoverGateStatus(c, req.auth.tenantId, id));
      return reply.send({ gate });
    } catch (err) {
      if (err instanceof HandoverError) return reply.code(404).send({ error: err.code });
      throw err;
    }
  });

  const certSchema = z.object({ certType: z.string(), reference: z.string().nullish(), bcmsRef: z.string().nullish(), validated: z.boolean().optional() });
  app.post('/api/v1/handovers/:id/certs', { preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = certSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const cert = await withTenant(req.auth.tenantId, (c) => addCert(c, req.auth.tenantId, { handoverId: id, ...p.data }));
    return reply.code(201).send({ cert });
  });

  const cobieSchema = z.object({ cobie: z.unknown(), defaultSpaceId: z.string().uuid().nullish() });
  app.post('/api/v1/handovers/:id/cobie', { preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = cobieSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    let parsed;
    try {
      parsed = parseCobie(p.data.cobie);
    } catch (e) {
      return reply.code(400).send({ error: 'unparseable_cobie', detail: (e as Error).message });
    }
    const result = await withTenant(req.auth.tenantId, (c) => importCobie(c, req.auth.tenantId, id, parsed, { defaultSpaceId: p.data.defaultSpaceId }));
    return reply.send(result);
  });

  app.post('/api/v1/handovers/:id/go-live', { preHandler: requireRole('TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const gate = await withTenant(req.auth.tenantId, (c) => goLive(c, req.auth.tenantId, id));
      return reply.send({ live: true, gate });
    } catch (err) {
      if (err instanceof HandoverError) {
        return reply.code(err.code === 'not_found' ? 404 : 409).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });
}
