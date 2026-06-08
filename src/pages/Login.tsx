import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Boxes, Loader2, ShieldCheck, Activity, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/auth/AuthProvider';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/auth/demo';
import { supabaseConfigured } from '@/lib/supabase';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function entrar(mail: string, pass: string) {
    setBusy(true);
    try {
      await signIn(mail, pass);
      navigate('/', { replace: true });
    } catch (e) {
      toast.error((e as Error).message || 'Falha ao entrar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Painel de marca — escuro, atmosférico (oculto no mobile). */}
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
          <p className="mt-4 animate-fade-up text-sm leading-relaxed text-sidebar-foreground/65" style={{ animationDelay: '80ms' }}>
            Entradas, saídas e validades sincronizadas entre toda a equipe no
            instante em que acontecem — sem planilhas, sem retrabalho.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-sidebar-foreground/80">
            {[
              { icon: Activity, t: 'Atualização instantânea entre dispositivos' },
              { icon: PackageCheck, t: 'Alerta de estoque baixo e validade próxima' },
              { icon: ShieldCheck, t: 'Acesso controlado por papel e auditoria' },
            ].map(({ icon: Icon, t }, i) => (
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

      {/* Painel de acesso. */}
      <main className="has-aura flex w-full flex-col items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 lg:hidden">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Boxes className="h-6 w-6" />
            </div>
          </div>

          <div className="mb-7">
            <h1 className="font-display text-2xl font-semibold tracking-tight">Entrar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acesse o painel de controle de estoque.
            </p>
          </div>

          {!supabaseConfigured && (
            <p className="mb-4 rounded-md bg-destructive/10 p-2 text-center text-xs text-destructive">
              Supabase não configurado (defina as variáveis de ambiente).
            </p>
          )}

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void entrar(email, password);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
            </Button>
          </form>

          <div className="relative my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => void entrar(DEMO_EMAIL, DEMO_PASSWORD)}
          >
            Entrar como demonstração
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            A conta demo registra movimentações sem alterar os cadastros base.
          </p>
        </div>
      </main>
    </div>
  );
}
