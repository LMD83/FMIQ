import * as React from 'react';
import { cn } from '@/lib/utils';

/** Consistent empty / error placeholder for lists and panels. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'default',
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'default' | 'error';
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)} role={tone === 'error' ? 'alert' : undefined}>
      {icon && <div className={cn('mb-1 [&_svg]:size-8', tone === 'error' ? 'text-crit' : 'text-muted-foreground')}>{icon}</div>}
      <div className="font-sans text-sm font-semibold">{title}</div>
      {description && <div className="max-w-sm text-sm text-muted-foreground">{description}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
