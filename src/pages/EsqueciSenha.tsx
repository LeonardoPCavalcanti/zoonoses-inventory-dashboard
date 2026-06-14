import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { authRedirectUrl } from '@/auth/redirect';
import { AuthLayout } from '@/components/auth/AuthLayout';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: authRedirectUrl(),
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      toast.error((err as Error).message || 'Falha ao enviar e-mail');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="w-full max-w-md text-center animate-fade-up">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MailCheck className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Verifique seu e-mail</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Se houver uma conta para <strong>{email}</strong>, enviamos um link para
            redefinir a senha.
          </p>
          <Button asChild variant="outline" className="mt-8">
            <Link to="/login">Voltar ao login</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-7">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Esqueci minha senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe seu e-mail e enviaremos um link de redefinição.
          </p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar link'}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
