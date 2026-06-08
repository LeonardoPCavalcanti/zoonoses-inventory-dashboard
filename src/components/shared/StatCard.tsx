import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { useCountUp } from '@/hooks/useCountUp';

interface StatCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: 'default' | 'warning' | 'danger';
  /** Atraso de entrada (stagger), em ms. */
  delay?: number;
}

const toneClasses: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-primary/10 text-primary',
  warning: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
  danger: 'bg-destructive/10 text-destructive',
};

/**
 * Card de métrica com número que conta de 0→valor ao montar e **pulsa**
 * quando o valor muda (evento de tempo real) — o momento-assinatura.
 */
export function StatCard({ label, value, icon, tone = 'default', delay = 0 }: StatCardProps) {
  const { value: shown, changed } = useCountUp(value);

  return (
    <Card
      className={cn(
        'animate-fade-up overflow-hidden transition-shadow',
        changed && 'animate-pulse-ring',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', toneClasses[tone])}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="tabular font-display text-3xl font-semibold leading-none tracking-tight">
            {shown}
          </p>
          <p className="mt-1.5 truncate text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
