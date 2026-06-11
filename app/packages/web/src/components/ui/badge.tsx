import * as React from 'react';
import { Check, AlertTriangle, X, Info, Minus } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * RAG status badge. FMIQ design law (WCAG 1.4.1): status is NEVER colour alone — every
 * tone carries an icon + its text label. Pass `icon={false}` only when an adjacent label
 * already conveys state.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-sans text-xs font-semibold leading-tight',
  {
    variants: {
      tone: {
        ok: 'bg-ok-bg text-ok',
        watch: 'bg-watch-bg text-watch',
        crit: 'bg-crit-bg text-crit',
        danger: 'bg-danger-bg text-danger',
        info: 'bg-info-bg text-info',
        neutral: 'bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

const TONE_ICON = {
  ok: Check, watch: AlertTriangle, crit: X, danger: X, info: Info, neutral: Minus,
} as const;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  icon?: boolean;
}

export function Badge({ className, tone, icon = true, children, ...props }: BadgeProps) {
  const Icon = TONE_ICON[tone ?? 'neutral'];
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  );
}

export { badgeVariants };
