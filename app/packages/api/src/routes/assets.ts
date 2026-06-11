import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import {
  AssetError, assetQrPayload, createAsset, exportAssetsCsv, getAsset, getAssetDetail,
  listAssetChildren, listAssets, locationTree, softDeleteAsset, updateAsset,
} from '../domain/assets.js';

const conditionGrade = z.enum(['A', 'B', 'C', 'D']);
const criticality = z.enum(['critical', 'high', 'medium', 'low']);

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  spaceId: z.string().uuid().nullish(),
  buildingId: z.string().uuid().nullish(),
  assetType: z.string().nullish(),
  manufacturer: z.string().nullish(),
  model: z.string().nullish(),
  serialNo: z.string().nullish(),
  assetTag: z.string().nullish(),
  uniclassCode: z.string().nullish(),
  sfg20Ref: z.string().nullish(),
  installDate: z.string().nullish(),
  conditionGrade: conditionGrade.nullish(),
  criticality: criticality.nullish(),
  expectedLifeYears: z.number().min(0).max(200).nullish(),
  replacementCost: z.number().min(0).nullish(),
  warrantyExpiry: z.string().nullish(),
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({
  q: z.string().max(200).optional(),
  spaceId: z.string().uuid().optional(),
  buildingId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  assetType: z.string().optional(),
  conditionGrade: conditionGrade.optional(),
  criticality: criticality.optional(),
  importSessionId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const writeRoles = ['FacilitiesManager', 'TenantAdmin', 'SystemAdmin'] as const;

export async function assetRoutes(app: FastifyInstance): Promise<void> {
  // Register list — full-text-ish search + filters + pagination (PRD §4.2)
  app.get('/api/v1/assets', async (req, reply) => {
    const q = listQuerySchema.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid_request', detail: q.error.flatten() });
    const result = await withTenant(req.auth.tenantId, (c) => listAssets(c, req.auth.tenantId, q.data));
    return reply.send(result);
  });

  // Filtered CSV export of the register (same filters as the list)
  app.get('/api/v1/assets/export.csv', async (req, reply) => {
    const q = listQuerySchema.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid_request', detail: q.error.flatten() });
    const csv = await withTenant(req.auth.tenantId, (c) => exportAssetsCsv(c, req.auth.tenantId, q.data));
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="fmiq-asset-register.csv"')
      .send(csv);
  });

  // Location hierarchy tree (Site → Building → Floor → Space) with asset counts
  app.get('/api/v1/locations/tree', async (req, reply) => {
    const tree = await withTenant(req.auth.tenantId, (c) => locationTree(c, req.auth.tenantId));
    return reply.send({ sites: tree });
  });

  app.get('/api/v1/assets/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const detail = await withTenant(req.auth.tenantId, (c) => getAssetDetail(c, req.auth.tenantId, id));
    if (!detail) return reply.code(404).send({ error: 'not_found' });
    return reply.send(detail);
  });

  app.get('/api/v1/assets/:id/children', async (req, reply) => {
    const { id } = req.params as { id: string };
    const children = await withTenant(req.auth.tenantId, (c) => listAssetChildren(c, req.auth.tenantId, id));
    return reply.send({ children });
  });

  app.get('/api/v1/assets/:id/qr', async (req, reply) => {
    const { id } = req.params as { id: string };
    const asset = await withTenant(req.auth.tenantId, (c) => getAsset(c, req.auth.tenantId, id));
    if (!asset) return reply.code(404).send({ error: 'not_found' });
    return reply.send(assetQrPayload(asset));
  });

  app.post('/api/v1/assets', { preHandler: requireRole(...writeRoles) }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    try {
      const asset = await withTenant(req.auth.tenantId, (c) => createAsset(c, req.auth.tenantId, parsed.data, req.auth.userId));
      return reply.code(201).send({ asset });
    } catch (err) {
      if (err instanceof AssetError) return reply.code(400).send({ error: err.code, message: err.message });
      throw err;
    }
  });

  app.patch('/api/v1/assets/:id', { preHandler: requireRole(...writeRoles) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    try {
      const asset = await withTenant(req.auth.tenantId, (c) => updateAsset(c, req.auth.tenantId, id, parsed.data, req.auth.userId));
      return reply.send({ asset });
    } catch (err) {
      if (err instanceof AssetError) {
        return reply.code(err.code === 'not_found' ? 404 : 400).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // Soft delete only — no hard deletes anywhere in the register
  app.delete('/api/v1/assets/:id', { preHandler: requireRole(...writeRoles) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await withTenant(req.auth.tenantId, (c) => softDeleteAsset(c, req.auth.tenantId, id, req.auth.userId));
      return reply.code(204).send();
    } catch (err) {
      if (err instanceof AssetError) {
        return reply.code(err.code === 'not_found' ? 404 : 400).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });
}
