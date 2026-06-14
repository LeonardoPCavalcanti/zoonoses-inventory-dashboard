import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  InputOTP, InputOTPGroup, InputOTPSlot,
} from '@/components/ui/input-otp';
import { useAuth } from '@/auth/AuthProvider';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/auth/demo';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { STATUS_MESSAGE, nextLoginStep, type AccountStatus } from '@/auth/loginState';
import { AuthLayout } from '@/components/auth/AuthLayout';

export default function Login() {
  const { signIn, blockedStatus, clearBlocked } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [mfa, setMfa] = useState<{ factorId: string } | null>(null);
  const [code, setCode] = useState('');

  async function afterPassword() {
    // Status primeiro: uma conta não-ACTIVE nunca deve sequer piscar o painel.
    // O AuthProvider também bloqueia (banner + signOut); aqui só evitamos navegar.
    const { data: status } = await supabase.rpc('my_account_status');
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const step = nextLoginStep({
      status: (status as AccountStatus | null) ?? 'PENDING',
      currentLevel: aal?.currentLevel ?? null,
      nextLevel: aal?.nextLevel ?? null,
    });

    if (step.step === 'blocked') {
      // AuthProvider cuida do banner e do signOut; não navegamos.
      return;
    }
    if (step.step === 'mfa_challenge') {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (totp) {
        setMfa({ factorId: totp.id });
        return;
      }
    }
    navigate('/', { replace: true });
  }

  async function entrar(mail: string, pass: string) {
    clearBlocked();
    setBusy(true);
    try {
      await signIn(mail, pass);
      await afterPassword();
    } catch (e) {
      toast.error((e as Error).message || 'Falha ao entrar');
    } finally {
      setBusy(false);
    }
  }

  async function verificarMfa() {
    if (!mfa) return;
    setBusy(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: mfa.factorId,
      });
      if (chErr) throw chErr;
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfa.factorId,
        challengeId: ch.id,
        code,
      });
      if (error) throw error;
      navigate('/', { replace: true });
    } catch (e) {
      toast.error((e as Error).message || 'Código inválido');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-7">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {mfa ? 'Verificação em duas etapas' : 'Entrar'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mfa
                ? 'Digite o código de 6 dígitos do seu app autenticador.'
                : 'Acesse o painel de controle de estoque.'}
            </p>
          </div>

          {!supabaseConfigured && (
            <p className="mb-4 rounded-md bg-destructive/10 p-2 text-center text-xs text-destructive">
              Supabase não configurado (defina as variáveis de ambiente).
            </p>
          )}

          {blockedStatus && !mfa && (
            <p className="mb-4 rounded-md bg-destructive/10 p-2 text-center text-xs text-destructive">
              {STATUS_MESSAGE[blockedStatus]}
            </p>
          )}

          {mfa ? (
            <div className="space-y-5">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode} aria-label="Código de autenticação de 6 dígitos">
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button className="w-full" disabled={busy || code.length < 6} onClick={() => void verificarMfa()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verificar'}
              </Button>
              <button type="button" className="w-full text-center text-xs text-muted-foreground hover:underline"
                onClick={() => { setMfa(null); setCode(''); }}>
                Cancelar
              </button>
            </div>
          ) : (
            <>
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void entrar(email, password); }}>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" autoComplete="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    <Link to="/esqueci-senha" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                      Esqueci minha senha
                    </Link>
                  </div>
                  <Input id="password" type="password" autoComplete="current-password" value={password}
                    onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
                </Button>
              </form>

              <div className="relative my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" />
              </div>

              <Button variant="outline" className="w-full" disabled={busy}
                onClick={() => void entrar(DEMO_EMAIL, DEMO_PASSWORD)}>
                Entrar como demonstração
              </Button>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                Não tem acesso?{' '}
                <Link to="/cadastrar" className="text-primary underline-offset-4 hover:underline">
                  Solicitar conta
                </Link>
              </p>
            </>
          )}
        </div>
    </AuthLayout>
  );
}
