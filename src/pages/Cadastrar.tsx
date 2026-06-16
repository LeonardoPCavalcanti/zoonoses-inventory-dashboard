import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabaseConfigured } from '@/lib/supabase';
import { validatePassword } from '@/auth/password';
import { soDigitos, validarCpf, formatarCpf, validarTelefoneBR, formatarTelefone } from '@/auth/identidade';
import { useCadastrar, useNucleosParaCadastro } from '@/data/users';
import { AuthLayout } from '@/components/auth/AuthLayout';

export default function Cadastrar() {
  const navigate = useNavigate();
  const cadastrar = useCadastrar();
  const nucleos = useNucleosParaCadastro();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [nucleoId, setNucleoId] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const cpfOk = validarCpf(cpf);
  const telOk = validarTelefoneBR(telefone);
  const pwdOk = validatePassword(password).ok;
  const podeEnviar = nome.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    && cpfOk && telOk && nucleoId && pwdOk && password === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validatePassword(password).ok) { toast.error(validatePassword(password).errors[0]); return; }
    if (password !== confirm) { toast.error('As senhas não coincidem.'); return; }
    try {
      await cadastrar.mutateAsync({
        nome, email, senha: password, cpf: soDigitos(cpf), telefone: soDigitos(telefone), nucleo_id: nucleoId,
      });
      navigate('/aguardando-aprovacao', { replace: true });
    } catch (err) {
      toast.error((err as Error).message || 'Falha ao cadastrar');
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-7">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Criar conta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Solicite acesso ao painel. Um administrador aprovará seu cadastro.
          </p>
        </div>

        {!supabaseConfigured && (
          <p className="mb-4 rounded-md bg-destructive/10 p-2 text-center text-xs text-destructive">
            Supabase não configurado (defina as variáveis de ambiente).
          </p>
        )}

        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome completo</Label>
            <Input id="nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail institucional</Label>
            <Input id="email" type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" inputMode="numeric" placeholder="(00) 90000-0000"
              value={formatarTelefone(telefone)} onChange={(e) => setTelefone(soDigitos(e.target.value))} required />
            {telefone && !telOk && <p className="text-xs text-destructive">Telefone inválido.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpf">CPF</Label>
            <Input id="cpf" inputMode="numeric" placeholder="000.000.000-00"
              value={formatarCpf(cpf)} onChange={(e) => setCpf(soDigitos(e.target.value))} required />
            {cpf && !cpfOk && <p className="text-xs text-destructive">CPF inválido.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Núcleo</Label>
            <Select value={nucleoId} onValueChange={setNucleoId}>
              <SelectTrigger><SelectValue placeholder="Selecione seu núcleo" /></SelectTrigger>
              <SelectContent>
                {(nucleos.data ?? []).map((n) => <SelectItem key={n.id} value={n.id}>{n.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres, com letra e número.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <Input id="confirm" type="password" autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={!podeEnviar || cadastrar.isPending}>
            {cadastrar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Solicitar acesso'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Já tem conta?{' '}
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">Entrar</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
