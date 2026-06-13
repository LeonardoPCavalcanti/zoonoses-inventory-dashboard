import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Boxes, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { validatePassword } from '@/auth/password';

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const check = validatePassword(password);
    if (!check.ok) {
      toast.error(check.errors[0]);
      return;
    }
    if (password !== confirm) {
      toast.error('As senhas não coincidem.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Senha redefinida. Entre com a nova senha.');
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error((err as Error).message || 'Falha ao redefinir');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="has-aura flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-7">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Boxes className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Definir nova senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">Escolha uma senha forte.</p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="password">Nova senha</Label>
            <Input id="password" type="password" autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres, com letra e número.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <Input id="confirm" type="password" autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Redefinir senha'}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
