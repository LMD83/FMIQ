import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import { addCompetency, approveRams, completePretask, contractorVault, createRams, issuePermit, reportIncident, signOutKey } from '../domain/ssow.js';

export async function ssowRoutes(app: FastifyInstance): Promise<void> {
  const ramsSchema = z.object({ workOrderId: z.string().uuid(), title: z.string(), validTo: z.string().nullish() });
  app.post('/api/v1/ssow/rams', { preHandler: requireRole('FacilitiesManager', 'MaintenanceTech', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const p = ramsSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const rams = await withTenant(req.auth.tenantId, (c) => createRams(c, req.auth.tenantId, p.data));
    return reply.code(201).send({ rams });
  });

  app.post('/api/v1/ssow/rams/:id/approve', { preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await withTenant(req.auth.tenantId, (c) => approveRams(c, req.auth.tenantId, id, req.auth.userId));
    return reply.send({ approved: true });
  });

  const permitSchema = z.object({ workOrderId: z.string().uuid(), permitType: z.string(), validTo: z.string().nullish() });
  app.post('/api/v1/ssow/permits', { preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const p = permitSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const permit = await withTenant(req.auth.tenantId, (c) => issuePermit(c, req.auth.tenantId, { ...p.data, authoriserId: req.auth.userId }));
    return reply.code(201).send({ permit });
  });

  const pretaskSchema = z.object({ workOrderId: z.string().uuid(), newHazard: z.boolean().optional() });
  app.post('/api/v1/ssow/pretask', { preHandler: requireRole('FacilitiesManager', 'MaintenanceTech', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const p = pretaskSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const pretask = await withTenant(req.auth.tenantId, (c) => completePretask(c, req.auth.tenantId, { ...p.data, byUser: req.auth.userId }));
    return reply.code(201).send({ pretask });
  });

  const keySchema = z.object({ keyId: z.string().uuid(), workOrderId: z.string().uuid() });
  app.post('/api/v1/ssow/keys/sign-out', { preHandler: requireRole('FacilitiesManager', 'MaintenanceTech', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const p = keySchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const loan = await withTenant(req.auth.tenantId, (c) => signOutKey(c, req.auth.tenantId, { ...p.data, byUser: req.auth.userId }));
    return reply.code(201).send({ loan });
  });

  // Contractor competency/document vault — record a document and read the compliance register.
  const compSchema = z.object({
    contractorId: z.string().uuid().nullish(),
    userId: z.string().uuid().nullish(),
    compType: z.enum(['safe_pass', 'reci', 'rgii', 'trade_cert', 'insurance', 'public_liability', 'employer_liability', 'induction']),
    expiry: z.string().nullish(),
    reference: z.string().nullish(),
    issuedOn: z.string().nullish(),
    verified: z.boolean().optional(),
  });
  app.post('/api/v1/ssow/competencies', { preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const p = compSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const competency = await withTenant(req.auth.tenantId, (c) => addCompetency(c, req.auth.tenantId, p.data));
    return reply.code(201).send({ competency });
  });

  app.get('/api/v1/ssow/contractor-vault', async (req, reply) => {
    const contractors = await withTenant(req.auth.tenantId, (c) => contractorVault(c, req.auth.tenantId));
    return reply.send({ contractors });
  });

  const incidentSchema = z.object({ spaceId: z.string().uuid().nullish(), kind: z.enum(['incident', 'near_miss']).optional(), reporterType: z.string().nullish(), riddorReportable: z.boolean().optional() });
  app.post('/api/v1/ssow/incidents', async (req, reply) => {
    const p = incidentSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const incident = await withTenant(req.auth.tenantId, (c) => reportIncident(c, req.auth.tenantId, p.data));
    return reply.code(201).send({ incident });
  });
}
