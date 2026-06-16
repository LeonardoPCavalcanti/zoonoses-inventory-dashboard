import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ASSUNTO: Record<string, string> = {
  criacao: 'Novo pedido aguardando análise',
  critica: 'Seu pedido recebeu uma crítica',
  aprovacao: 'Seu pedido foi aprovado',
  rejeicao: 'Seu pedido foi rejeitado',
  atrasados: 'Pedidos parados em análise',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido' });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey);

    const body = await req.json().catch(() => ({}));
    const tipo = String(body.tipo ?? '');
    if (!ASSUNTO[tipo]) return json(400, { error: 'tipo inválido' });

    const ids: string[] = Array.isArray(body.pedido_ids)
      ? body.pedido_ids.map(String)
      : body.pedido_id ? [String(body.pedido_id)] : [];

    // Resolve destinatários: analistas (ADMIN/FINANCIAL_MANAGER) para 'criacao'/'atrasados';
    // o solicitante do pedido para 'critica'/'aprovacao'/'rejeicao'.
    let recipientIds: string[] = [];
    if (tipo === 'criacao' || tipo === 'atrasados') {
      const { data } = await admin.from('profiles').select('id')
        .in('role', ['ADMIN', 'FINANCIAL_MANAGER']).eq('status', 'ACTIVE');
      recipientIds = (data ?? []).map((r) => r.id);
    } else if (ids.length) {
      const { data } = await admin.from('pedidos').select('solicitante_id').in('id', ids);
      recipientIds = [...new Set((data ?? []).map((r) => r.solicitante_id).filter(Boolean) as string[])];
    }

    const { data: users } = await admin.auth.admin.listUsers();
    const emails = (users?.users ?? [])
      .filter((u) => recipientIds.includes(u.id) && u.email)
      .map((u) => u.email!) as string[];

    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('NOTIFY_FROM');
    if (!apiKey || !from) {
      // Inerte por design: pipe fiado, mas sem provedor configurado não envia nada.
      return json(200, { sent: 0, reason: 'SMTP não configurado', recipients: emails });
    }

    const assunto = ASSUNTO[tipo];
    let sent = 0;
    for (const to of emails) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject: assunto, text: `${assunto}. Acesse a plataforma para detalhes.` }),
      });
      if (r.ok) sent++;
    }
    return json(200, { sent, recipients: emails });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
