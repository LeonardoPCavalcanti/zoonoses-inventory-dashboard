import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  Boxes,
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  History,
  Settings2,
  Users,
  Moon,
  Sun,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthProvider';
import { ROLE_LABEL, type Capability } from '@/auth/roles';

const nav: { to: string; label: string; icon: typeof Users; end?: boolean; cap?: Capability }[] = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/produtos', label: 'Produtos', icon: Package },
  { to: '/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
  { to: '/auditoria', label: 'Auditoria', icon: History },
  { to: '/cadastros', label: 'Cadastros', icon: Settings2 },
  { to: '/admin/usuarios', label: 'Usuários', icon: Users, cap: 'manage_users' },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut, can } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const visibleNav = nav.filter((n) => !n.cap || can(n.cap));
  const titulo = visibleNav.find((n) => (n.end ? n.to === location.pathname : location.pathname.startsWith(n.to)))
    ?.label;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — painel escuro em contraste */}
      <aside className="hidden w-64 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-black/20">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-lg font-semibold tracking-tight">Zoonoses</p>
            <p className="text-[0.7rem] uppercase tracking-[0.14em] text-sidebar-foreground/50">
              Controle de Estoque
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {visibleNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary transition-all duration-200',
                      isActive ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <Icon className="h-[1.05rem] w-[1.05rem]" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border px-5 py-4">
          <p className="text-xs text-sidebar-foreground/55">
            {profile ? (
              <>
                Sessão · <span className="text-sidebar-foreground/80">{profile.role ? ROLE_LABEL[profile.role] : '—'}</span>
              </>
            ) : (
              'Carregando…'
            )}
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-card/80 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-semibold tracking-tight">{titulo ?? 'Painel'}</h1>
            <span className="hidden items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-primary sm:inline-flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Ao vivo
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Alternar tema"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            {profile && (
              <span className="hidden text-sm text-muted-foreground sm:inline">{profile.nome}</span>
            )}
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut className="mr-1 h-4 w-4" /> Sair
            </Button>
          </div>
        </header>

        {/* Transição leve por rota (key remonta o conteúdo) */}
        <main key={location.pathname} className="flex-1 animate-fade-up p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
