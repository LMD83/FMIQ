import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  api, getOpsSummary, listCertAlerts, listRequisitions,
  type Zone, type WorkOrder, type Project, type CertAlert,
} from '../api';
import { useT } from '../i18n';
import { StatusBadge, type RagTone } from '../components/StatusBadge';

/**
 * Role front-doors (S12) — one screen, one question per role, live via React Query.
 * Director / FM / Conservation / Finance.
 */
type Role = 'director' | 'fm' | 'conservation' | 'finance';

export function Dashboards() {
  const { t } = useT();
  const [role, setRole] = useState<Role>('director');
  const tabs: { id: Role; label: string }[] = [
    { id: 'director', label: t('role.director') },
    { id: 'fm', label: t('role.fm') },
    { id: 'conservation', label: t('role.conservation') },
    { id: 'finance', label: t('role.finance') },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{t('dash.title')}</div>
          <div className="page-sub">{t('dash.sub')}</div>
        </div>
      </div>
      <div className="role-tabs" role="tablist">
        {tabs.map((tab) => (
          <button key={tab.id} role="tab" aria-selected={role === tab.id} className={`role-tab ${role === tab.id ? 'active' : ''}`} onClick={() => setRole(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
      {role === 'director' && <Director />}
      {role === 'fm' && <FacilitiesManager />}
      {role === 'conservation' && <Conservation />}
      {role === 'finance' && <Finance />}
    </>
  );
}

function Director() {
  const { t } = useT();
  const ops = useQuery({ queryKey: ['ops'], queryFn: getOpsSummary });
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => api<{ projects: Project[] }>('/api/v1/projects') });
  const ppm = ops.data?.statutoryPpmCompliancePct ?? 100;
  return (
    <>
      <div className="kpi-row">
        <Kpi label={t('dash.openWorkOrders')} value={ops.data?.openWorkOrders ?? 0} />
        <Kpi label={t('dash.activeExcursions')} value={ops.data?.activeExcursions ?? 0} tone={(ops.data?.activeExcursions ?? 0) > 0 ? 'crit' : 'ok'} />
        <Kpi label={t('dash.statutoryPpm')} value={`${ppm}%`} tone={ppm >= 95 ? 'ok' : ppm >= 90 ? 'watch' : 'crit'} />
        <Kpi label={t('dash.committed')} value={`€${((ops.data?.committedSpend ?? 0) / 1000).toFixed(1)}k`} />
      </div>
      <div className="panel">
        <div className="panel-head"><h3>Capital projects</h3></div>
        <div className="panel-body">
          {(projects.data?.projects ?? []).map((p, i) => (
            <div className="barrow" key={i}>
              <span className="lab" style={{ width: 220 }}>{p.name}</span>
              <span className="track"><i style={{ width: `${p.spend_pct}%` }} /></span>
              <StatusBadge tone={p.status_rag === 'red' ? 'crit' : p.status_rag === 'amber' ? 'watch' : 'ok'}>{p.status_rag ?? 'green'}</StatusBadge>
            </div>
          ))}
          {!projects.data?.projects?.length && <Empty />}
        </div>
      </div>
    </>
  );
}

function FacilitiesManager() {
  const wos = useQuery({ queryKey: ['fm-wo'], queryFn: () => api<{ workOrders: WorkOrder[] }>('/api/v1/work-orders') });
  const alerts = useQuery({ queryKey: ['cert-alerts'], queryFn: listCertAlerts });
  const open = (wos.data?.workOrders ?? []).filter((w) => w.status !== 'closed');
  return (
    <div className="grid2">
      <div className="panel">
        <div className="panel-head"><h3>Open work orders</h3><span className="hint">{open.length}</span></div>
        <div className="panel-body">
          {open.slice(0, 10).map((w) => (
            <div className="role-row" key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{w.title} <span className="muted">· {w.ref}</span></span>
              <StatusBadge tone={w.priority === 'critical' ? 'crit' : w.priority === 'high' ? 'watch' : 'neutral'}>{w.priority}</StatusBadge>
            </div>
          ))}
          {!open.length && <Empty />}
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><h3>Certificates expiring</h3></div>
        <div className="panel-body">
          {(alerts.data?.alerts ?? []).map((a: CertAlert) => (
            <div className="role-row" key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{a.cert_type_code} <span className="muted">· {a.ref ?? '—'}</span></span>
              <StatusBadge tone={a.tier <= 7 ? 'crit' : a.tier <= 30 ? 'watch' : 'info'}>{a.days_until}d</StatusBadge>
            </div>
          ))}
          {!alerts.data?.alerts?.length && <Empty text="No certificates due in 90 days." />}
        </div>
      </div>
    </div>
  );
}

function Conservation() {
  const zones = useQuery({ queryKey: ['zones'], queryFn: () => api<{ zones: Zone[] }>('/api/v1/zones') });
  return (
    <div className="panel">
      <div className="panel-head"><h3>Monitored zones</h3><span className="hint">{zones.data?.zones?.length ?? 0}</span></div>
      <div className="panel-body">
        <div className="zones">
          {(zones.data?.zones ?? []).map((z) => (
            <div className={`zone ${z.status}`} key={z.id}>
              <div className="zh">
                <div><div className="zn">{z.name}</div><div className="zl">{z.space_name}</div></div>
                <StatusBadge tone={z.status === 'ok' ? 'ok' : z.status === 'watch' ? 'watch' : 'crit'}>{z.status === 'ok' ? 'In band' : z.status === 'watch' ? 'Watch' : 'Excursion'}</StatusBadge>
              </div>
              <div className="metrics">
                <div className="metric"><div className="ml">RH</div><div className="mv tnum">{z.rh != null ? `${Number(z.rh).toFixed(1)}%` : '—'}</div></div>
                <div className="metric"><div className="ml">Temp</div><div className="mv tnum">{z.temp != null ? `${Number(z.temp).toFixed(1)}°` : '—'}</div></div>
              </div>
            </div>
          ))}
          {!zones.data?.zones?.length && <Empty />}
        </div>
      </div>
    </div>
  );
}

function Finance() {
  const reqs = useQuery({ queryKey: ['reqs'], queryFn: listRequisitions });
  const ops = useQuery({ queryKey: ['ops'], queryFn: getOpsSummary });
  const rows = (reqs.data?.requisitions ?? []) as Array<{ id: string; amount_net: number; status: string; category: string }>;
  return (
    <>
      <div className="kpi-row">
        <Kpi label="Committed spend" value={`€${((ops.data?.committedSpend ?? 0) / 1000).toFixed(1)}k`} />
        <Kpi label="Requisitions" value={rows.length} />
        <Kpi label="Pending approval" value={rows.filter((r) => r.status === 'pending_approval').length} tone="watch" />
        <Kpi label="Committed" value={rows.filter((r) => r.status === 'committed').length} tone="ok" />
      </div>
      <div className="panel">
        <div className="panel-head"><h3>Requisitions</h3></div>
        <div className="panel-body">
          {rows.slice(0, 12).map((r) => (
            <div className="role-row" key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>€{Number(r.amount_net).toLocaleString('en-IE')} <span className="muted">· {r.category}</span></span>
              <StatusBadge tone={r.status === 'committed' ? 'ok' : r.status === 'rejected' ? 'crit' : 'watch'}>{r.status.replace('_', ' ')}</StatusBadge>
            </div>
          ))}
          {!rows.length && <Empty text="No requisitions yet." />}
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: RagTone }) {
  return (
    <div className="kpi">
      <div className="lbl">{label}</div>
      <div className="val tnum">{value}</div>
      {tone && <div style={{ marginTop: 8 }}><StatusBadge tone={tone}>{tone === 'ok' ? 'OK' : tone === 'watch' ? 'Watch' : tone === 'crit' ? 'Action' : '—'}</StatusBadge></div>}
    </div>
  );
}

function Empty({ text = 'Nothing to show — start the stack with “npm run dev”.' }: { text?: string }) {
  return <div className="muted" style={{ fontSize: 13, padding: 8 }}>{text}</div>;
}
