import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const RANK: Record<string, number> = {
  ADMIN: 5, FINANCIAL_MANAGER: 4, STOCKIST: 3, NUCLEUS_SUPERVISOR: 2, AUDITOR: 1,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido' });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    // Identifica o chamador pelo JWT.
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uerr } = await userClient.auth.getUser();
    if (uerr || !user) return json(401, { error: 'Não autenticado' });

    const admin = createClient(url, serviceKey);

    // Só ADMIN ativo cria usuários.
    const { data: actor } = await admin.from('profiles').select('role,status').eq('id', user.id).single();
    if (!actor || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') {
      return json(403, { error: 'Apenas administradores podem criar usuários' });
    }

    const body = await req.json().catch(() => ({}));
    const nome = (body.nome ?? '').trim();
    const email = (body.email ?? '').trim().toLowerCase();
    const role = body.role as string;
    const sector = body.sector ? String(body.sector) : null;
    if (!nome || !email || !role) return json(400, { error: 'Campos obrigatórios: nome, email, papel' });
    if (!RANK[role] || RANK[role] >= RANK['ADMIN']) return json(400, { error: 'Papel inválido' });

    // Cria o usuário (e-mail confirmado; senha definida depois via link).
    const { data: created, error: cerr } = await admin.auth.admin.createUser({
      email, email_confirm: true, user_metadata: { nome },
    });
    if (cerr || !created.user) return json(400, { error: cerr?.message ?? 'Falha ao criar usuário' });

    // O trigger criou o profile PENDING; promove a ACTIVE com papel.
    const { error: perr } = await admin.from('profiles')
      .update({ role, status: 'ACTIVE', sector, created_by: user.id })
      .eq('id', created.user.id);
    if (perr) return json(400, { error: perr.message });

    await admin.from('user_audit_log').insert({
      actor_id: user.id, target_id: created.user.id, action: 'admin_create',
      to_role: role, to_status: 'ACTIVE', note: sector,
    });

    // Link de definição de senha (NÃO envia e-mail; admin repassa ao usuário).
    const redirectTo = body.redirectTo ? String(body.redirectTo) : undefined;
    const { data: link } = await admin.auth.admin.generateLink({
      type: 'recovery', email, options: redirectTo ? { redirectTo } : undefined,
    });

    return json(200, { ok: true, userId: created.user.id, link: link?.properties?.action_link ?? null });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
