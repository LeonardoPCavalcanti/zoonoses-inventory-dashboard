import type { ReactNode } from 'react';
import { Boxes, Activity, PackageCheck, ShieldCheck } from 'lucide-react';

const FEATURES = [
  { icon: Activity, t: 'Atualização instantânea entre dispositivos' },
  { icon: PackageCheck, t: 'Alerta de estoque baixo e validade próxima' },
  { icon: ShieldCheck, t: 'Acesso controlado por papel e auditoria' },
];

/**
 * Moldura compartilhada das páginas de autenticação: painel atmosférico da marca
 * à esquerda (≥lg) + área de conteúdo à direita. Cada página fornece seu próprio
 * wrapper interno (largura/alinhamento) para acomodar formulários e telas de
 * mensagem. Single-purpose: só o layout; nenhuma dependência de dados.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0"
          style={{
            backgroundImage:
              'radial-gradient(42rem 30rem at 18% -6%, hsl(170 70% 46% / 0.22), transparent 60%), radial-gradient(34rem 26rem at 96% 104%, hsl(36 70% 55% / 0.12), transparent 58%)',
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-black/30">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-lg font-semibold tracking-tight">Zoonoses</p>
            <p className="text-[0.7rem] uppercase tracking-[0.14em] text-sidebar-foreground/50">
              Controle de Estoque
            </p>
          </div>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="animate-fade-up font-display text-4xl font-semibold leading-[1.1] tracking-tight">
            O estoque do centro,
            <br />
            <span className="text-sidebar-primary">vivo e em tempo real.</span>
          </h2>
          <ul className="mt-8 space-y-3 text-sm text-sidebar-foreground/80">
            {FEATURES.map(({ icon: Icon, t }, i) => (
              <li
                key={t}
                className="flex animate-fade-up items-center gap-3"
                style={{ animationDelay: `${160 + i * 70}ms` }}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-primary">
                  <Icon className="h-4 w-4" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-sidebar-foreground/40">
          Centro de Controle de Zoonoses · Painel operacional
        </p>
      </aside>

      <main className="has-aura flex w-full flex-col items-center justify-center p-6 lg:w-1/2">
        {children}
      </main>
    </div>
  );
}
