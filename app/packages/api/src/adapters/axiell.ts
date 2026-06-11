import { z } from 'zod';

/**
 * Axiell Collections adapter (read-only, data-minimised). FMIQ stores ONLY the object
 * reference + sensitivity + its zone — never the catalogue (GDPR data minimisation;
 * richer sync needs a DPIA). domain/cms.ts upserts these into cc_object_link.
 */
export interface CmsObject {
  cmsObjectRef: string;
  objectName: string;
  material: string | null;
  sensitivity: 'low' | 'med' | 'high';
  primaryZoneRef: string;
}

const schema = z.object({
  records: z.array(
    z.object({
      object_number: z.string(),
      title: z.string().optional(),
      medium: z.string().optional(),
      sensitivity: z.string().optional(),
      location: z.string(), // maps to a zone external ref
    }),
  ),
});

function normaliseSensitivity(s: string | undefined): 'low' | 'med' | 'high' {
  const v = (s ?? '').trim().toLowerCase();
  if (v.startsWith('high') || v === 'fragile') return 'high';
  if (v.startsWith('low')) return 'low';
  return 'med';
}

export function parseAxiellObjects(payload: unknown): CmsObject[] {
  const b = schema.parse(payload);
  return b.records.map((r) => ({
    cmsObjectRef: r.object_number,
    objectName: r.title ?? r.object_number,
    material: r.medium ?? null,
    sensitivity: normaliseSensitivity(r.sensitivity),
    primaryZoneRef: r.location,
  }));
}
