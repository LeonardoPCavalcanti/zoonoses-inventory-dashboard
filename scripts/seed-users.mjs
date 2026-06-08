// Cria as contas de demonstração no Supabase Auth e ajusta os papéis.
// Lê as chaves do ambiente — NÃO contém segredos.
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE=... node scripts/seed-users.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
if (!url || !serviceRole) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE no ambiente.');
  process.exit(1);
}

const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

const contas = [
  { email: 'demo@zoonoses.app', password: 'demo-zoonoses-2026', nome: 'Operador Demo', papel: 'operador' },
  { email: 'admin@zoonoses.app', password: 'admin-zoonoses-2026', nome: 'Administrador', papel: 'admin' },
];

for (const c of contas) {
  // Cria (ou ignora se já existir) o usuário com e-mail confirmado.
  const { data, error } = await admin.auth.admin.createUser({
    email: c.email,
    password: c.password,
    email_confirm: true,
    user_metadata: { nome: c.nome },
  });

  let userId = data?.user?.id;
  if (error) {
    if (!/already|exists|registered/i.test(error.message)) {
      console.error(`Erro ao criar ${c.email}:`, error.message);
      continue;
    }
    // Já existe: localiza o id pela listagem.
    const { data: list } = await admin.auth.admin.listUsers();
    userId = list?.users.find((u) => u.email === c.email)?.id;
  }
  if (!userId) {
    console.error(`Sem id para ${c.email}`);
    continue;
  }

  // Garante o papel correto no profile (o trigger cria como 'operador').
  const { error: upErr } = await admin
    .from('profiles')
    .update({ nome: c.nome, papel: c.papel })
    .eq('id', userId);
  if (upErr) console.error(`Erro ao definir papel de ${c.email}:`, upErr.message);
  else console.log(`OK ${c.email} -> ${c.papel}`);
}

console.log('Concluído.');
