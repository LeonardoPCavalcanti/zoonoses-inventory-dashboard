import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * Recebe o retorno dos e-mails do Supabase (PKCE: `?code=...`). Troca o código
 * por sessão e roteia conforme a intenção: recovery -> redefinir senha; convite
 * ou confirmação de cadastro -> app (ProtectedRoute resolve o destino).
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      // No HashRouter o `?code` vem no search do hash; o supabase-js lê de window.location.
      const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
      const type = params.get('type'); // 'recovery' | 'invite' | 'signup' | etc.
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) throw error;
        if (type === 'recovery') {
          navigate('/redefinir-senha', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } catch (e) {
        setErro((e as Error).message || 'Link inválido ou expirado.');
      }
    };
    void run();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      {erro ? (
        <div className="max-w-sm">
          <p className="text-sm text-destructive">{erro}</p>
          <a href="#/login" className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline">
            Voltar ao login
          </a>
        </div>
      ) : (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
