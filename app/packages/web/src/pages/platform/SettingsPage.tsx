import { authEnabled } from '../../authConfig';
import { useT } from '../../i18n';
import { StatusBadge } from '../../components/StatusBadge';

/** Settings — tenant, identity and platform configuration (route /settings). Placeholder for nav completeness. */
export function SettingsPage() {
  const { lang, setLang } = useT();

  return (
    <>
      <div className="page-head"><div><div className="page-title">Settings</div><div className="page-sub">Tenant, identity and platform configuration. Role and user administration arrive with the admin module.</div></div></div>
      <div className="grid3">
        <div className="panel"><div className="panel-body">
          <div style={{ fontFamily: 'var(--f-ui)', fontWeight: 600 }}>Identity &amp; access</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Azure Entra ID single sign-on; roles assigned via App Roles.</div>
          <div style={{ marginTop: 10 }}>
            {authEnabled
              ? <StatusBadge tone="ok">Entra ID sign-in active</StatusBadge>
              : <StatusBadge tone="watch">Development mode (no auth)</StatusBadge>}
          </div>
        </div></div>
        <div className="panel"><div className="panel-body">
          <div style={{ fontFamily: 'var(--f-ui)', fontWeight: 600 }}>Language</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Bilingual interface (Official Languages Act 2003).</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button className={lang === 'en' ? 'btn' : 'btn ghost'} onClick={() => setLang('en')}>English</button>
            <button className={lang === 'ga' ? 'btn' : 'btn ghost'} onClick={() => setLang('ga')}>Gaeilge</button>
          </div>
        </div></div>
        <div className="panel"><div className="panel-body">
          <div style={{ fontFamily: 'var(--f-ui)', fontWeight: 600 }}>Data residency</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>PostgreSQL on Azure North Europe (Ireland), EU Data Boundary. Row-level security per tenant.</div>
          <div style={{ marginTop: 10 }}><StatusBadge tone="ok">EU-resident</StatusBadge></div>
        </div></div>
      </div>
    </>
  );
}
