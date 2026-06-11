import * as React from 'react';
import {
  Activity, LayoutDashboard, Gauge, Map, LifeBuoy, Wrench, CalendarClock, Smartphone,
  ShieldCheck, ScrollText, Building2, Boxes, ClipboardCheck, HardHat, Leaf, IdCard,
  FileText, FolderCheck, Plug, BarChart3, Search, Languages, Menu, Circle, Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export interface NavItem { id: string; label: string; group: string }

const ICONS: Record<string, LucideIcon> = {
  command: Activity, roles: LayoutDashboard, dashboard: Gauge, twin: Map, helpdesk: LifeBuoy,
  maintenance: Wrench, ppm: CalendarClock, field: Smartphone, compliance: ShieldCheck,
  certificates: ScrollText, estate: Building2, inventory: Boxes, approvals: ClipboardCheck,
  projects: HardHat, sustain: Leaf, contractors: IdCard, documents: FileText, evidence: FolderCheck,
  integrations: Plug, reports: BarChart3, settings: Settings,
};

export function AppShell({
  nav, groups, active, onNavigate, badges = {}, onToggleLang, langLabel, children,
}: {
  nav: NavItem[];
  groups: string[];
  active: string;
  onNavigate: (id: string) => void;
  badges?: Record<string, number>;
  onToggleLang: () => void;
  langLabel: string;
  children: React.ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [mobileNav, setMobileNav] = React.useState(false);
  const activeLabel = nav.find((n) => n.id === active)?.label;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (id: string) => { onNavigate(id); setPaletteOpen(false); setMobileNav(false); };

  const Sidebar = (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-primary text-primary-foreground">
      <div className="border-b border-white/10 px-5 pb-4 pt-5">
        <div className="font-display text-2xl leading-none text-white">FMIQ</div>
        <div className="mt-1.5 font-sans text-[10.5px] uppercase tracking-[0.15em] text-white/60">by GovIQ · IWMS</div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3" aria-label="Primary">
        {groups.map((group) => (
          <div key={group} className="mb-1">
            <div className="px-3 pb-1.5 pt-3.5 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">{group}</div>
            {nav.filter((n) => n.group === group).map((n) => {
              const Icon = ICONS[n.id] ?? Circle;
              const isActive = active === n.id;
              const badge = badges[n.id];
              return (
                <button
                  key={n.id}
                  onClick={() => go(n.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'mb-0.5 flex h-9 w-full items-center gap-3 rounded-md px-3 text-left font-sans text-[13.5px] font-medium transition-colors',
                    isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{n.label}</span>
                  {badge ? <span className="ml-auto rounded-full bg-crit px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">{badge}</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 px-5 py-3.5 font-sans text-[11px] text-white/55">Azure North Europe · EU-resident</div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <div className="hidden md:block">{Sidebar}</div>

      {/* Mobile drawer */}
      {mobileNav && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNav(false)} aria-hidden />
          <div className="absolute left-0 top-0 h-full">{Sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-15 shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3 md:px-6">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" onClick={() => setMobileNav(true)}><Menu /></Button>
          <div className="font-sans text-[15px] font-semibold">
            {activeLabel} <span className="font-normal text-muted-foreground">· National Museum of Ireland</span>
          </div>

          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto hidden items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 font-sans text-xs text-muted-foreground transition-colors hover:bg-accent sm:flex"
            aria-label="Open command menu"
          >
            <Search className="size-3.5" /> Search…
            <kbd className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </button>

          <Button variant="ghost" size="icon" className="ml-auto sm:hidden" aria-label="Open command menu" onClick={() => setPaletteOpen(true)}>
            <Search />
          </Button>

          <Button variant="ghost" size="sm" onClick={onToggleLang} aria-label="Switch language"><Languages className="size-4" /> {langLabel}</Button>
          <ThemeToggle />
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-sans text-[13px] font-semibold text-primary-foreground" title="Aoife N. — Conservation Officer">AN</div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 md:p-6">{children}</main>
      </div>

      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Jump to a module, site or action…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          {groups.map((group) => (
            <CommandGroup key={group} heading={group}>
              {nav.filter((n) => n.group === group).map((n) => {
                const Icon = ICONS[n.id] ?? Circle;
                return (
                  <CommandItem key={n.id} value={n.label} onSelect={() => go(n.id)}>
                    <Icon /> {n.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
