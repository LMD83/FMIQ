import { Chip } from '../../components/Chip';

const INTEGRATIONS: Array<[string, string, string]> = [
  ['Conserv', 'Collection-care sensors (webhook)', 'Connected'],
  ['Hanwell Pro', 'Heritage data loggers', 'Connected'],
  ['Axiell Collections', 'Object risk linkage', 'Connected'],
  ['Trend BMS (BACnet)', 'Building management', 'Connected'],
  ['Azure Entra ID', 'SSO · B2B · SCIM', 'Active'],
  ['Power BI / OData', 'Analytics feed', 'Available'],
];

/** Integrations directory (route /integrations). */
export function IntegrationsPage() {
  return (
    <>
      <div className="page-head"><div><div className="page-title">Integrations</div><div className="page-sub">Hardware-agnostic adapters and open APIs. We integrate; we don’t replace your sensors or your catalogue.</div></div></div>
      <div className="grid3">
        {INTEGRATIONS.map(([nm, d, st]) => (
          <div className="panel" key={nm}><div className="panel-body">
            <div style={{ fontFamily: 'var(--f-ui)', fontWeight: 600 }}>{nm}</div>
            <div className="muted" style={{ fontSize: 12 }}>{d}</div>
            <div style={{ marginTop: 8 }}><Chip kind={st === 'Available' ? 'neutral' : 'ok'}>{st}</Chip></div>
          </div></div>
        ))}
      </div>
    </>
  );
}
