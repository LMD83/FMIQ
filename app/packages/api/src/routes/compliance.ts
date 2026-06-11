import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import { certsDueForAlert, createCertificate, recordInspection } from '../domain/compliance.js';

export async function complianceCertRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/compliance/certificates', async (req, reply) => {
    const certificates = await withTenant(req.auth.tenantId, async (c) => {
      const { rows } = await c.query(
        `SELECT id, cert_type_code, ref, issuer, issue_date, expiry_date, status FROM cmp_certificate ORDER BY expiry_date NULLS LAST LIMIT 500`,
      );
      return rows;
    });
    return reply.send({ certificates });
  });

  app.get('/api/v1/compliance/alerts', async (req, reply) => {
    const alerts = await withTenant(req.auth.tenantId, (c) => certsDueForAlert(c, req.auth.tenantId));
    return reply.send({ alerts });
  });

  const certSchema = z.object({
    certTypeCode: z.string(),
    ref: z.string().nullish(),
    issuer: z.string().nullish(),
    issueDate: z.string().nullish(),
    expiryDate: z.string().nullish(),
    buildingId: z.string().uuid().nullish(),
    assetId: z.string().uuid().nullish(),
    bcmsRef: z.string().nullish(),
  });
  app.post('/api/v1/compliance/certificates', { preHandler: requireRole('FacilitiesManager', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const parsed = certSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    const cert = await withTenant(req.auth.tenantId, (c) => createCertificate(c, req.auth.tenantId, parsed.data));
    return reply.code(201).send({ certificate: cert });
  });

  const inspectionSchema = z.object({
    obligationId: z.string().uuid().nullish(),
    certificateId: z.string().uuid().nullish(),
    spaceId: z.string().uuid().nullish(),
    items: z.array(z.object({ label: z.string(), pass: z.boolean(), photoUri: z.string().nullish(), note: z.string().nullish() })).min(1),
  });
  app.post('/api/v1/compliance/inspections', { preHandler: requireRole('FacilitiesManager', 'MaintenanceTech', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const parsed = inspectionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    const result = await withTenant(req.auth.tenantId, (c) => recordInspection(c, req.auth.tenantId, { ...parsed.data, performedBy: req.auth.userId }));
    return reply.code(201).send(result);
  });
}
