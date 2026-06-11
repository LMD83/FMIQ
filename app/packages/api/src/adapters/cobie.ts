import { z } from 'zod';

/**
 * COBie ingestion (BS EN ISO 19650 / COBie). The upload wizard converts the spreadsheet
 * (or IFC via web-ifc) to this JSON; we validate the required sheets and normalise to a
 * flat model. domain/handover.ts turns it into assets, PPM schedules, warranties, spares.
 */
export interface CobieComponent {
  name: string;
  type: string;            // category → est_asset.asset_type (drives PPM lookup)
  space?: string;
  manufacturer?: string;
  installDate?: string;
  warrantyMonths?: number;
}
export interface CobieSpare {
  name: string;
  partNumber?: string;
  manufacturer?: string;
}
export interface ParsedCobie {
  components: CobieComponent[];
  spares: CobieSpare[];
  spaces: string[];
}

const schema = z.object({
  Component: z.array(
    z.object({
      Name: z.string(),
      Type: z.string().optional(),
      Space: z.string().optional(),
      Manufacturer: z.string().optional(),
      InstallationDate: z.string().optional(),
      WarrantyDurationParts: z.number().optional(),
    }),
  ),
  Space: z.array(z.object({ Name: z.string() })).optional(),
  Spare: z.array(z.object({ Name: z.string(), PartNumber: z.string().optional(), Manufacturer: z.string().optional() })).optional(),
});

export function parseCobie(payload: unknown): ParsedCobie {
  const b = schema.parse(payload);
  if (b.Component.length === 0) throw new Error('COBie: Component sheet is empty');
  return {
    components: b.Component.map((c) => ({
      name: c.Name,
      type: c.Type ?? 'unknown',
      space: c.Space,
      manufacturer: c.Manufacturer,
      installDate: c.InstallationDate,
      warrantyMonths: c.WarrantyDurationParts,
    })),
    spares: (b.Spare ?? []).map((s) => ({ name: s.Name, partNumber: s.PartNumber, manufacturer: s.Manufacturer })),
    spaces: (b.Space ?? []).map((s) => s.Name),
  };
}
