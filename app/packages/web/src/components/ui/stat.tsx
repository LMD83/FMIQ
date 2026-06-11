import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

/** A KPI stat tile — uppercase label, large tabular value, optional delta/hint and trend. */
export function Stat({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'default' | 'ok' | 'watch' | 'crit';
  className?: string;
}) {
  const toneText = tone === 'ok' ? 'text-ok' : tone === 'watch' ? 'text-watch' : tone === 'crit' ? 'text-crit' : 'text-foreground';
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
      </div>
      <div className={cn('mt-2.5 font-sans text-3xl font-bold leading-none tabular-nums', toneText)}>{value}</div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
