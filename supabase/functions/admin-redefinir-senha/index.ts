import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido' });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uerr } = await userClient.auth.getUser();
    if (uerr || !user) return json(401, { error: 'Não autenticado' });

    const admin = createClient(url, serviceKey);
    const { data: actor } = await admin.from('profiles').select('role,status').eq('id', user.id).single();
    if (!actor || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') {
      return json(403, { error: 'Apenas administradores podem redefinir senhas' });
    }

    const body = await req.json().catch(() => ({}));
    const targetId = String(body.target_id ?? '');
    const redirectTo = body.redirectTo ? String(body.redirectTo) : undefined;
    if (!targetId) return json(400, { error: 'target_id obrigatório' });

    const { data: target } = await admin.auth.admin.getUserById(targetId);
    const email = target?.user?.email;
    if (!email) return json(404, { error: 'Usuário não encontrado' });

    const { data: link, error: lerr } = await admin.auth.admin.generateLink({
      type: 'recovery', email, options: redirectTo ? { redirectTo } : undefined,
    });
    if (lerr) return json(400, { error: lerr.message });

    await admin.from('user_audit_log').insert({
      actor_id: user.id, target_id: targetId, action: 'admin_reset_password',
    });

    return json(200, { ok: true, link: link?.properties?.action_link ?? null });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
