import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { requireRole } from '../auth/rbac.js';
import { ImportParseError, MAX_BYTES, parseUpload } from '../domain/importParse.js';
import {
  ImportError,
  commitSession, createImportSession, getEntityDecisions, getMappings, getSession,
  getValueMaps, listDuplicates, listRows, listSessions, patchRows, resolveHierarchy,
  runDedupe, runDryRun, runValidation, setDuplicateResolutions, setEntityDecisions,
  setMappings, setValueMaps, undoSession,
} from '../domain/imports.js';

/**
 * Import wizard API — Sprint-1 create-only path (PRD §6, §9). Every write requires
 * FacilitiesManager+ (PRD: "import endpoints require FacilitiesManager+"); every call
 * is tenant-scoped through withTenant/RLS; every state change is audited in the domain
 * layer. No hard deletes anywhere.
 */

const writeRoles = ['FacilitiesManager', 'TenantAdmin', 'SystemAdmin'] as const;

const createSchema = z.object({
  filename: z.string().min(1).max(255),
  /** Base64 file content (multipart upload arrives in Sprint 2 with @fastify/multipart). */
  contentBase64: z.string().min(1),
  targetMode: z.literal('create_only').default('create_only'),
});

const mappingsSchema = z.object({
  mappings: z.array(z.object({ sourceColumn: z.string().min(1), targetField: z.string().min(1).nullable() })).min(1),
});

const valueMapsSchema = z.object({
  valueMaps: z.array(z.object({
    targetField: z.string().min(1),
    sourceValue: z.string(),
    mappedValue: z.string().nullable(),
  })).min(1),
});

const rowsPatchSchema = z.object({
  edits: z.array(z.object({
    rowId: z.string().uuid(),
    raw: z.record(z.union([z.string(), z.number(), z.null()])).optional(),
    exclude: z.boolean().optional(),
  })).min(1).max(500),
});

const decisionsSchema = z.object({
  decisions: z.array(z.object({
    entity: z.enum(['site', 'building', 'floor', 'space']),
    inboundKey: z.string().min(1),
    action: z.enum(['link', 'create']),
    linkedId: z.string().uuid().nullish(),
  })).min(1),
});

const resolutionsSchema = z.object({
  resolutions: z.array(z.object({
    rowId: z.string().uuid(),
    action: z.enum(['create', 'skip']),
  })).min(1),
});

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function sendImportError(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, err: ImportError): unknown {
  const status =
    err.code === 'not_found' ? 404 :
    err.code === 'bad_state' || err.code === 'errors_block_commit' ||
    err.code === 'unconfirmed_entities' || err.code === 'unresolved_duplicates' ||
    err.code === 'undo_expired' ? 409 : 400;
  return reply.code(status).send({ error: err.code, message: err.message });
}

export async function importRoutes(app: FastifyInstance): Promise<void> {
  // Stage 0–2: upload + parse + auto-map. Base64 inflates ~4/3, so allow headroom.
  app.post('/api/v1/imports', {
    preHandler: requireRole(...writeRoles),
    bodyLimit: Math.ceil(MAX_BYTES * 1.5),
  }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    let buf: Buffer;
    try {
      buf = Buffer.from(parsed.data.contentBase64, 'base64');
    } catch {
      return reply.code(400).send({ error: 'invalid_request', message: 'contentBase64 is not valid base64.' });
    }
    try {
      const upload = parseUpload(parsed.data.filename, buf);
      const result = await withTenant(req.auth.tenantId, (c) =>
        createImportSession(c, req.auth.tenantId, {
          filename: parsed.data.filename,
          sizeBytes: buf.length,
          parsed: upload,
          targetMode: parsed.data.targetMode,
        }, req.auth.userId));
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof ImportParseError) return reply.code(422).send({ error: err.code, message: err.message });
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  // Session history dashboard + session state
  app.get('/api/v1/imports', async (req, reply) => {
    const sessions = await withTenant(req.auth.tenantId, (c) => listSessions(c));
    return reply.send({ sessions });
  });

  app.get('/api/v1/imports/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const session = await withTenant(req.auth.tenantId, (c) => getSession(c, id));
      return reply.send({ session });
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  // Stage 2: column mappings (exact > remembered > fuzzy; confidence + provenance)
  app.get('/api/v1/imports/:id/mappings', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const mappings = await withTenant(req.auth.tenantId, (c) => getMappings(c, id));
      return reply.send({ mappings });
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  app.put('/api/v1/imports/:id/mappings', { preHandler: requireRole(...writeRoles) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = mappingsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    try {
      const mappings = await withTenant(req.auth.tenantId, (c) =>
        setMappings(c, req.auth.tenantId, id, parsed.data.mappings, req.auth.userId));
      return reply.send({ mappings });
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  // Stage 3: enum value mappings (condition 1-5/Good-Fair-Poor → A-D, criticality → tiers)
  app.get('/api/v1/imports/:id/value-maps', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const valueMaps = await withTenant(req.auth.tenantId, (c) => getValueMaps(c, id));
      return reply.send({ valueMaps });
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  app.put('/api/v1/imports/:id/value-maps', { preHandler: requireRole(...writeRoles) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = valueMapsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    try {
      const valueMaps = await withTenant(req.auth.tenantId, (c) =>
        setValueMaps(c, req.auth.tenantId, id, parsed.data.valueMaps, req.auth.userId));
      return reply.send({ valueMaps });
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  // Stage 4: server-side validation (errors block / warnings pass) + fix-in-grid
  app.post('/api/v1/imports/:id/validate', { preHandler: requireRole(...writeRoles) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const counts = await withTenant(req.auth.tenantId, (c) =>
        runValidation(c, req.auth.tenantId, id, todayIso(), req.auth.userId));
      return reply.send({ counts });
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  app.get('/api/v1/imports/:id/rows', async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = z.object({
      state: z.enum(['pending', 'valid', 'warning', 'error', 'excluded']).optional(),
      limit: z.coerce.number().int().min(1).max(1000).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid_request', detail: q.error.flatten() });
    try {
      const rows = await withTenant(req.auth.tenantId, (c) => listRows(c, id, q.data));
      return reply.send({ rows });
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  app.patch('/api/v1/imports/:id/rows', { preHandler: requireRole(...writeRoles) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = rowsPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    try {
      const result = await withTenant(req.auth.tenantId, (c) =>
        patchRows(c, req.auth.tenantId, id, parsed.data.edits, todayIso(), req.auth.userId));
      return reply.send(result);
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  // Stage 5: hierarchy resolution — explicit link-vs-create, no silent creation
  app.post('/api/v1/imports/:id/hierarchy/resolve', { preHandler: requireRole(...writeRoles) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const decisions = await withTenant(req.auth.tenantId, (c) =>
        resolveHierarchy(c, req.auth.tenantId, id, req.auth.userId));
      return reply.send({ decisions });
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  app.get('/api/v1/imports/:id/entity-decisions', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const decisions = await withTenant(req.auth.tenantId, (c) => getEntityDecisions(c, id));
      return reply.send({ decisions });
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  app.put('/api/v1/imports/:id/entity-decisions', { preHandler: requireRole(...writeRoles) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = decisionsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    try {
      const decisions = await withTenant(req.auth.tenantId, (c) =>
        setEntityDecisions(c, req.auth.tenantId, id, parsed.data.decisions, req.auth.userId));
      return reply.send({ decisions });
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  // Stage 6: exact-key dedupe (asset tag; serial+model) — surfaced, never silent
  app.post('/api/v1/imports/:id/dedupe', { preHandler: requireRole(...writeRoles) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const groups = await withTenant(req.auth.tenantId, (c) =>
        runDedupe(c, req.auth.tenantId, id, req.auth.userId));
      return reply.send({ groups });
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  app.get('/api/v1/imports/:id/duplicates', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const groups = await withTenant(req.auth.tenantId, (c) => listDuplicates(c, id));
      return reply.send({ groups });
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  app.put('/api/v1/imports/:id/duplicates/resolutions', { preHandler: requireRole(...writeRoles) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = resolutionsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    try {
      const result = await withTenant(req.auth.tenantId, (c) =>
        setDuplicateResolutions(c, req.auth.tenantId, id, parsed.data.resolutions, req.auth.userId));
      return reply.send(result);
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  // Stage 7: dry-run → commit → undo (counts must match exactly — AC3/AC6)
  app.post('/api/v1/imports/:id/dry-run', { preHandler: requireRole(...writeRoles) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const dryRun = await withTenant(req.auth.tenantId, (c) =>
        runDryRun(c, req.auth.tenantId, id, req.auth.userId));
      return reply.send({ dryRun });
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  app.post('/api/v1/imports/:id/commit', { preHandler: requireRole(...writeRoles) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const result = await withTenant(req.auth.tenantId, (c) =>
        commitSession(c, req.auth.tenantId, id, req.auth.userId));
      return reply.send(result);
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });

  app.post('/api/v1/imports/:id/undo', { preHandler: requireRole(...writeRoles) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const result = await withTenant(req.auth.tenantId, (c) =>
        undoSession(c, req.auth.tenantId, id, req.auth.userId));
      return reply.send(result);
    } catch (err) {
      if (err instanceof ImportError) return sendImportError(reply, err);
      throw err;
    }
  });
}
