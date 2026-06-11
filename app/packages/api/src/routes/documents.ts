import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import {
  addVersion, documentVersions, goldenThread, linkDocument, listDocuments, registerDocument,
  type DocType, type LinkEntity,
} from '../domain/documents.js';

const docTypes = ['om_manual', 'drawing', 'certificate', 'warranty', 'policy', 'rams', 'datasheet', 'report', 'specification', 'other'] as const;
const entityTypes = ['asset', 'building', 'space', 'site', 'certificate', 'handover', 'work_order', 'project'] as const;

export async function documentRoutes(app: FastifyInstance): Promise<void> {
  const registerSchema = z.object({
    title: z.string().min(1),
    docType: z.enum(docTypes).optional(),
    discipline: z.string().nullish(),
    reference: z.string().nullish(),
    goldenThread: z.boolean().optional(),
    blobUri: z.string().min(1),
    fileName: z.string().nullish(),
    mimeType: z.string().nullish(),
    sizeBytes: z.number().int().nonnegative().nullish(),
    checksum: z.string().nullish(),
    notes: z.string().nullish(),
  });
  app.post('/api/v1/documents', { preHandler: requireRole('FacilitiesManager', 'MaintenanceTech', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const p = registerSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const document = await withTenant(req.auth.tenantId, (c) =>
      registerDocument(c, req.auth.tenantId, { ...p.data, createdBy: req.auth.userId }));
    return reply.code(201).send({ document });
  });

  app.get('/api/v1/documents', async (req, reply) => {
    const q = req.query as { docType?: string; goldenThread?: string };
    const documents = await withTenant(req.auth.tenantId, (c) =>
      listDocuments(c, {
        docType: q.docType as DocType | undefined,
        goldenThread: q.goldenThread === undefined ? undefined : q.goldenThread === 'true',
      }));
    return reply.send({ documents });
  });

  app.get('/api/v1/documents/:id/versions', async (req, reply) => {
    const { id } = req.params as { id: string };
    const versions = await withTenant(req.auth.tenantId, (c) => documentVersions(c, id));
    return reply.send({ versions });
  });

  const versionSchema = z.object({
    blobUri: z.string().min(1),
    fileName: z.string().nullish(),
    mimeType: z.string().nullish(),
    sizeBytes: z.number().int().nonnegative().nullish(),
    checksum: z.string().nullish(),
    notes: z.string().nullish(),
  });
  app.post('/api/v1/documents/:id/versions', { preHandler: requireRole('FacilitiesManager', 'MaintenanceTech', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = versionSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    const result = await withTenant(req.auth.tenantId, (c) =>
      addVersion(c, req.auth.tenantId, id, { ...p.data, uploadedBy: req.auth.userId }));
    return reply.code(201).send(result);
  });

  const linkSchema = z.object({ entityType: z.enum(entityTypes), entityId: z.string().uuid() });
  app.post('/api/v1/documents/:id/links', { preHandler: requireRole('FacilitiesManager', 'MaintenanceTech', 'TenantAdmin', 'SystemAdmin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = linkSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request', detail: p.error.flatten() });
    await withTenant(req.auth.tenantId, (c) => linkDocument(c, req.auth.tenantId, id, p.data.entityType, p.data.entityId));
    return reply.code(201).send({ ok: true });
  });

  // The golden thread for an entity — all current linked documents.
  app.get('/api/v1/golden-thread/:entityType/:entityId', async (req, reply) => {
    const { entityType, entityId } = req.params as { entityType: string; entityId: string };
    if (!entityTypes.includes(entityType as LinkEntity)) return reply.code(400).send({ error: 'invalid_entity_type' });
    const documents = await withTenant(req.auth.tenantId, (c) => goldenThread(c, entityType as LinkEntity, entityId));
    return reply.send({ documents });
  });
}
