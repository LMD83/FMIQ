import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { useT } from './i18n';
import { NAV, NAV_GROUPS, activeNavId } from './nav';
import { useSummary } from './hooks/usePortfolio';

// Pages (extracted from the former monolithic App.tsx)
import { CommandCentrePage } from './pages/collection-care/CommandCentrePage';
import { EstateDashboardPage } from './pages/dashboard/EstateDashboardPage';
import { WorkOrdersPage } from './pages/work-orders/WorkOrdersPage';
import { CompliancePage } from './pages/compliance/CompliancePage';
import { ProjectsPage } from './pages/projects/ProjectsPage';
import { SustainabilityPage } from './pages/sustainability/SustainabilityPage';
import { IntegrationsPage } from './pages/platform/IntegrationsPage';
import { ReportsPage } from './pages/platform/ReportsPage';
import { SettingsPage } from './pages/platform/SettingsPage';
import { AssetsPage } from './pages/assets/AssetsPage';
import { AssetDetailPage } from './pages/assets/AssetDetailPage';
import { AssetImportPage } from './pages/assets/AssetImportPage';

// Pre-existing module views (already split; now routed)
import { Dashboards } from './views/Dashboards';
import { Field } from './views/Field';
import { FloorMap } from './views/FloorMap';
import { Helpdesk } from './views/Helpdesk';
import { Documents } from './views/Documents';
import { EvidencePacks } from './views/EvidencePacks';
import { Ppm } from './views/Ppm';
import { Certificates } from './views/Certificates';
import { Inventory } from './views/Inventory';
import { Approvals } from './views/Approvals';
import { ContractorCompliance } from './views/ContractorCompliance';

/** Shell layout route — persistent sidebar + top bar, content via <Outlet />. */
function ShellLayout() {
  const { t, lang, setLang } = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const summary = useSummary();

  return (
    <AppShell
      nav={NAV}
      groups={NAV_GROUPS}
      active={activeNavId(location.pathname)}
      onNavigate={(id) => {
        const entry = NAV.find((n) => n.id === id);
        if (entry) navigate(entry.path);
      }}
      badges={summary.data ? { command: summary.data.excursions, maintenance: summary.data.openWorkOrders } : {}}
      onToggleLang={() => setLang(lang === 'en' ? 'ga' : 'en')}
      langLabel={t('lang.toggle')}
    >
      <div className="content-legacy">
        <Outlet />
      </div>
    </AppShell>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ShellLayout />}>
          <Route path="/" element={<Navigate to="/collection-care" replace />} />
          <Route path="/collection-care" element={<CommandCentrePage />} />
          <Route path="/roles" element={<Dashboards />} />
          <Route path="/dashboard" element={<EstateDashboardPage />} />
          <Route path="/floor-map" element={<FloorMap />} />
          <Route path="/helpdesk" element={<Helpdesk />} />
          <Route path="/work-orders" element={<WorkOrdersPage />} />
          <Route path="/ppm" element={<Ppm />} />
          <Route path="/field" element={<Field />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/certificates" element={<Certificates />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/assets/import" element={<AssetImportPage />} />
          <Route path="/assets/:id" element={<AssetDetailPage />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/sustainability" element={<SustainabilityPage />} />
          <Route path="/contractors" element={<ContractorCompliance />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/evidence" element={<EvidencePacks />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/collection-care" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
