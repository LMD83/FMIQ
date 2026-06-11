import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../db/withTenant.js';
import { captureIssue, resolveAssetByQr, IssueCaptureError } from '../domain/issueCapture.js';

/**
 * QR mobile issue capture — Snapfix-style. Scan → resolve asset → report → work
 * order. Reporting is deliberately low-privilege (adoption depends on it): any
 * authenticated user may resolve a QR and raise an issue.
 */
export async function issueRoutes(app: FastifyInstance): Promise<void> {
  // Scan resolution — the capture screen calls this to show "what / where".
  app.get('/api/v1/assets/by-qr/:qrUid', async (req, reply) => {
    const { qrUid } = req.params as { qrUid: string };
    const asset = await withTenant(req.auth.tenantId, (client) => resolveAssetByQr(client, qrUid));
    if (!asset) return reply.code(404).send({ error: 'asset_not_found' });
    return reply.send({ asset });
  });

  // Report an issue → reactive work order (+ optional photo).
  const issueSchema = z
    .object({
      qrUid: z.string().optional(),
      assetId: z.string().uuid().optional(),
      description: z.string().min(1),
      priority: z.enum(['routine', 'high', 'critical']).optional(),
      reporterName: z.string().optional(),
      photoUrl: z.string().url().optional(),
      photoCaption: z.string().optional(),
    })
    .refine((v) => v.qrUid || v.assetId, { message: 'qrUid or assetId required' });

  app.post('/api/v1/issues', async (req, reply) => {
    const parsed = issueSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', detail: parsed.error.flatten() });
    try {
      const result = await withTenant(req.auth.tenantId, (client) =>
        captureIssue(client, req.auth.tenantId, parsed.data),
      );
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof IssueCaptureError) {
        const code = err.code === 'asset_not_found' ? 404 : 400;
        return reply.code(code).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });
}
