import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Boxes, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-xl">Controle de Estoque</CardTitle>
            <CardDescription>Centro de Zoonoses · acesso restrito</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!supabaseConfigured && (
            <p className="rounded-md bg-destructive/10 p-2 text-center text-xs text-destructive">
              Supabase não configurado (defina as variáveis de ambiente).
            </p>
          )}
          <form
            className="space-y-3"
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

          <div className="relative py-1 text-center">
            <span className="bg-card px-2 text-xs text-muted-foreground">ou</span>
          </div>

          <Button
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => void entrar(DEMO_EMAIL, DEMO_PASSWORD)}
          >
            Entrar como demonstração
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            A conta demo registra movimentações sem alterar os cadastros base.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
