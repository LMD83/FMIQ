/**
 * Single source of truth for the sidebar/router map. Each nav entry pairs the
 * stable nav id (used by AppShell icons/badges) with its route path.
 */
export interface NavEntry {
  id: string;
  label: string;
  group: string;
  path: string;
}

export const NAV_GROUPS: string[] = ['Overview', 'Operate', 'Records', 'Platform'];

export const NAV: NavEntry[] = [
  { id: 'command', label: 'Collection-Care Centre', group: 'Overview', path: '/collection-care' },
  { id: 'roles', label: 'Role dashboards', group: 'Overview', path: '/roles' },
  { id: 'dashboard', label: 'Estate Dashboard', group: 'Overview', path: '/dashboard' },
  { id: 'twin', label: 'Live floor map', group: 'Overview', path: '/floor-map' },
  { id: 'helpdesk', label: 'Help desk', group: 'Operate', path: '/helpdesk' },
  { id: 'maintenance', label: 'Maintenance', group: 'Operate', path: '/work-orders' },
  { id: 'ppm', label: 'Planned maintenance', group: 'Operate', path: '/ppm' },
  { id: 'field', label: 'Field app (mobile)', group: 'Operate', path: '/field' },
  { id: 'compliance', label: 'Compliance', group: 'Operate', path: '/compliance' },
  { id: 'certificates', label: 'Certificates', group: 'Operate', path: '/certificates' },
  { id: 'estate', label: 'Estate & Assets', group: 'Operate', path: '/assets' },
  { id: 'inventory', label: 'Stores & inventory', group: 'Operate', path: '/inventory' },
  { id: 'approvals', label: 'Approvals', group: 'Operate', path: '/approvals' },
  { id: 'projects', label: 'Projects (CWMF)', group: 'Operate', path: '/projects' },
  { id: 'sustain', label: 'Sustainability', group: 'Operate', path: '/sustainability' },
  { id: 'contractors', label: 'Contractor compliance', group: 'Records', path: '/contractors' },
  { id: 'documents', label: 'Documents & O&M', group: 'Records', path: '/documents' },
  { id: 'evidence', label: 'Evidence packs', group: 'Records', path: '/evidence' },
  { id: 'integrations', label: 'Integrations', group: 'Platform', path: '/integrations' },
  { id: 'reports', label: 'Reports', group: 'Platform', path: '/reports' },
  { id: 'settings', label: 'Settings', group: 'Platform', path: '/settings' },
];

/** Resolve which nav entry a pathname belongs to (longest matching path prefix). */
export function activeNavId(pathname: string): string {
  let best: NavEntry | null = null;
  for (const n of NAV) {
    if (pathname === n.path || pathname.startsWith(`${n.path}/`)) {
      if (!best || n.path.length > best.path.length) best = n;
    }
  }
  return best?.id ?? 'command';
}
