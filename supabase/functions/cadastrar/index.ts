import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const soDigitos = (v: string) => (v ?? '').replace(/\D/g, '');
function cpfValido(cpf: string): boolean {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dig = (fim: number) => {
    let s = 0; for (let i = 0; i < fim; i++) s += Number(d[i]) * (fim + 1 - i);
    const r = (s * 10) % 11; return r === 10 ? 0 : r;
  };
  return dig(9) === Number(d[9]) && dig(10) === Number(d[10]);
}
const telefoneValido = (t: string) => /^[1-9][0-9](9[0-9]{8}|[2-5][0-9]{7})$/.test(soDigitos(t));
const senhaForte = (p: string) => p.length >= 8 && /[a-zA-Z]/.test(p) && /[0-9]/.test(p);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido' });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey);

    const body = await req.json().catch(() => ({}));
    const nome = String(body.nome ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const senha = String(body.senha ?? '');
    const nucleoId = String(body.nucleo_id ?? '');
    const cpf = soDigitos(String(body.cpf ?? ''));
    const telefone = soDigitos(String(body.telefone ?? ''));

    if (!nome) return json(400, { error: 'Informe o nome completo' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: 'E-mail inválido' });
    if (!senhaForte(senha)) return json(400, { error: 'Senha fraca (mínimo 8 caracteres, com letra e número)' });
    if (!cpfValido(cpf)) return json(400, { error: 'CPF inválido' });
    if (!telefoneValido(telefone)) return json(400, { error: 'Telefone inválido' });
    if (!nucleoId) return json(400, { error: 'Selecione o núcleo' });

    const { data: nucleo } = await admin.from('nucleos').select('id').eq('id', nucleoId).maybeSingle();
    if (!nucleo) return json(400, { error: 'Núcleo inválido' });

    // Unicidade (excluindo rejeitados) — mensagens claras antes de criar o auth user.
    const { data: dupCpf } = await admin.from('profiles').select('id')
      .eq('cpf', cpf).neq('status', 'REJECTED').limit(1);
    if (dupCpf && dupCpf.length) return json(409, { error: 'CPF já cadastrado' });
    const { data: dupTel } = await admin.from('profiles').select('id')
      .eq('telefone', telefone).neq('status', 'REJECTED').limit(1);
    if (dupTel && dupTel.length) return json(409, { error: 'Telefone já cadastrado' });

    // Cria o usuário (nasce PENDING via trigger).
    const { data: created, error: cerr } = await admin.auth.admin.createUser({
      email, password: senha, email_confirm: false, user_metadata: { nome },
    });
    if (cerr || !created.user) {
      const msg = (cerr?.message ?? '').toLowerCase().includes('already')
        ? 'E-mail já cadastrado' : (cerr?.message ?? 'Falha ao cadastrar');
      return json(409, { error: msg });
    }

    // Completa o profile; em falha, remove o auth user para não deixar órfão.
    const { error: perr } = await admin.from('profiles')
      .update({ nome, cpf, telefone, nucleo_id: nucleoId }).eq('id', created.user.id);
    if (perr) {
      await admin.auth.admin.deleteUser(created.user.id);
      const dup = perr.message.includes('profiles_cpf_uniq') ? 'CPF já cadastrado'
        : perr.message.includes('profiles_telefone_uniq') ? 'Telefone já cadastrado'
        : perr.message;
      return json(409, { error: dup });
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
