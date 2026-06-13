import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  InputOTP, InputOTPGroup, InputOTPSlot,
} from '@/components/ui/input-otp';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { validatePassword } from '@/auth/password';
import { ROLE_LABEL } from '@/auth/roles';

interface Enrolling {
  factorId: string;
  qr: string;
  secret: string;
}

export default function Conta() {
  const { profile, role } = useAuth();
  const [pwd, setPwd] = useState('');
  const [busyPwd, setBusyPwd] = useState(false);

  const [hasTotp, setHasTotp] = useState(false);
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState('');
  const [busyMfa, setBusyMfa] = useState(false);

  useEffect(() => {
    supabase.auth.mfa
      .listFactors()
      .then(({ data }) => {
        setHasTotp(Boolean(data?.totp?.length));
      })
      .catch(() => toast.error('Não foi possível verificar o status do 2FA.'));
  }, []);

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    const check = validatePassword(pwd);
    if (!check.ok) { toast.error(check.errors[0]); return; }
    setBusyPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success('Senha atualizada.');
      setPwd('');
    } catch (err) {
      toast.error((err as Error).message || 'Falha ao atualizar senha');
    } finally {
      setBusyPwd(false);
    }
  }

  async function iniciarEnroll() {
    setBusyMfa(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (err) {
      toast.error((err as Error).message || 'Falha ao iniciar 2FA');
    } finally {
      setBusyMfa(false);
    }
  }

  async function confirmarEnroll() {
    if (!enrolling) return;
    setBusyMfa(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: enrolling.factorId,
      });
      if (chErr) throw chErr;
      const { error } = await supabase.auth.mfa.verify({
        factorId: enrolling.factorId, challengeId: ch.id, code,
      });
      if (error) throw error;
      toast.success('2FA ativado.');
      setEnrolling(null); setCode(''); setHasTotp(true);
    } catch (err) {
      toast.error((err as Error).message || 'Código inválido');
    } finally {
      setBusyMfa(false);
    }
  }

  async function desativar() {
    setBusyMfa(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.[0];
      if (!totp) throw new Error('Nenhum fator de 2FA encontrado.');
      const { error } = await supabase.auth.mfa.unenroll({ factorId: totp.id });
      if (error) throw error;
      setHasTotp(false);
      toast.success('2FA desativado.');
    } catch (err) {
      toast.error((err as Error).message || 'Falha ao desativar');
    } finally {
      setBusyMfa(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Minha conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile?.nome}
          {role && <> · <span className="text-foreground/80">{ROLE_LABEL[role]}</span></>}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trocar senha</CardTitle>
          <CardDescription>Mínimo 8 caracteres, com letra e número.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex items-end gap-3" onSubmit={trocarSenha}>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="newpwd">Nova senha</Label>
              <Input id="newpwd" type="password" autoComplete="new-password" value={pwd}
                onChange={(e) => setPwd(e.target.value)} required />
            </div>
            <Button type="submit" disabled={busyPwd}>
              {busyPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {hasTotp ? <ShieldCheck className="h-4 w-4 text-primary" /> : <ShieldOff className="h-4 w-4 text-muted-foreground" />}
            Autenticação em duas etapas (TOTP)
          </CardTitle>
          <CardDescription>
            {hasTotp
              ? 'Ativa. Seu login exige um código do app autenticador.'
              : 'Adicione uma camada extra com um app como Google Authenticator ou Authy.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasTotp && !enrolling && (
            <Button variant="outline" onClick={() => void desativar()} disabled={busyMfa}>
              {busyMfa ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Desativar 2FA'}
            </Button>
          )}

          {!hasTotp && !enrolling && (
            <Button onClick={() => void iniciarEnroll()} disabled={busyMfa}>
              {busyMfa ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ativar 2FA'}
            </Button>
          )}

          {enrolling && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Escaneie o QR no seu app autenticador e digite o código gerado.
              </p>
              <img src={enrolling.qr} alt="QR Code para 2FA" className="h-44 w-44 rounded-md border bg-white p-2" />
              <p className="text-xs text-muted-foreground">
                Ou insira a chave manualmente: <code className="rounded bg-muted px-1">{enrolling.secret}</code>
              </p>
              <div className="flex justify-start">
                <InputOTP maxLength={6} value={code} onChange={setCode} aria-label="Código de 6 dígitos do app autenticador">
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (<InputOTPSlot key={i} index={i} />))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void confirmarEnroll()} disabled={busyMfa || code.length < 6}>
                  {busyMfa ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
                </Button>
                <Button variant="ghost" onClick={() => { setEnrolling(null); setCode(''); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
