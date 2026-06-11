import type { PoolClient } from 'pg';
import type { CmsObject } from '../adapters/axiell.js';

/**
 * CMS object sync (read-only, data-minimised). Full-refresh per zone+vendor so a
 * nightly pull stays idempotent. Only ref/name/material/sensitivity/zone are stored —
 * never the catalogue (GDPR). These rows are what the excursion engine names as at-risk.
 */
export async function syncObjectsForZone(
  client: PoolClient,
  tenantId: string,
  zoneId: string,
  vendor: 'axiell' | 'tms' | 'mimsy',
  objects: CmsObject[],
): Promise<{ synced: number }> {
  await client.query(`DELETE FROM cc_object_link WHERE cc_zone_id = $1 AND cms_vendor = $2`, [zoneId, vendor]);
  for (const o of objects) {
    await client.query(
      `INSERT INTO cc_object_link (tenant_id, cc_zone_id, cms_vendor, cms_object_id, object_name, material, sensitivity)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [tenantId, zoneId, vendor, o.cmsObjectRef, o.objectName, o.material, o.sensitivity],
    );
  }
  await client.query(
    `INSERT INTO core_audit_log (tenant_id, entity, entity_id, action, after)
     VALUES ($1,'cc_object_link',$2,'cms.synced',$3)`,
    [tenantId, zoneId, JSON.stringify({ vendor, count: objects.length })],
  );
  return { synced: objects.length };
}
