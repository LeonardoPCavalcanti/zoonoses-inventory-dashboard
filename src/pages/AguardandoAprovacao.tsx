import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { AuthLayout } from '@/components/auth/AuthLayout';

export default function AguardandoAprovacao() {
  // O signUp deixa uma sessão ativa de uma conta PENDING. Encerramos aqui para
  // não manter o usuário meio-autenticado enquanto aguarda aprovação.
  useEffect(() => {
    void supabase.auth.signOut();
  }, []);

  return (
    <AuthLayout>
      <div className="w-full max-w-md text-center animate-fade-up">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MailCheck className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Solicitação enviada
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Sua conta foi criada e aguarda aprovação de um administrador. Você
          receberá um e-mail com o link para definir sua senha assim que o acesso
          for liberado.
        </p>
        <Button asChild variant="outline" className="mt-8">
          <Link to="/login">Voltar ao login</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
