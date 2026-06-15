import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const CARGO: Record<string, string> = {
  ADMIN: 'Administrador',
  FINANCIAL_MANAGER: 'Gestor Financeiro',
};
const BUCKET = 'pedidos-documentos';

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
    const { data: actor } = await admin.from('profiles').select('role,status,nome').eq('id', user.id).single();
    if (!actor || actor.status !== 'ACTIVE' || !['ADMIN', 'FINANCIAL_MANAGER'].includes(actor.role)) {
      return json(403, { error: 'Sem permissão para aprovar pedidos' });
    }

    const body = await req.json().catch(() => ({}));
    const pedidoId = String(body.pedido_id ?? '');
    const assinaturaPng = String(body.assinatura_png ?? '');
    const itensAprovados = Array.isArray(body.itens_aprovados) ? body.itens_aprovados : [];
    const comentario = body.comentario ? String(body.comentario) : null;
    if (!pedidoId || !assinaturaPng.startsWith('data:image/png')) {
      return json(400, { error: 'pedido_id e assinatura_png (PNG) são obrigatórios' });
    }

    // Documento ORIGINAL (se houver) para carimbar e calcular o hash.
    const { data: docs } = await admin.from('pedido_documentos')
      .select('storage_path,filename').eq('pedido_id', pedidoId).eq('tipo', 'ORIGINAL')
      .order('enviado_em', { ascending: false }).limit(1);
    const original = docs?.[0];

    let pdf: PDFDocument;
    let hash = '(sem documento original)';
    if (original) {
      const dl = await admin.storage.from(BUCKET).download(original.storage_path);
      if (dl.error || !dl.data) return json(400, { error: 'Falha ao ler o documento original' });
      const bytes = new Uint8Array(await dl.data.arrayBuffer());
      hash = await sha256Hex(bytes);
      const isPdf = original.filename.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        pdf = await PDFDocument.load(bytes);
      } else {
        pdf = await PDFDocument.create();
        const page = pdf.addPage();
        const img = original.filename.toLowerCase().match(/\.(jpe?g)$/)
          ? await pdf.embedJpg(bytes)
          : await pdf.embedPng(bytes);
        const { width, height } = page.getSize();
        const scaled = img.scaleToFit(width - 80, height - 200);
        page.drawImage(img, { x: 40, y: height - 60 - scaled.height, width: scaled.width, height: scaled.height });
      }
    } else {
      pdf = await PDFDocument.create();
      pdf.addPage();
    }

    // Página de aval (carimbo da plataforma) + assinatura embutida.
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const sigBytes = Uint8Array.from(atob(assinaturaPng.split(',')[1]), (c) => c.charCodeAt(0));
    const sigImg = await pdf.embedPng(sigBytes);
    const aval = pdf.addPage();
    const { height } = aval.getSize();
    const cargo = CARGO[actor.role] ?? actor.role;
    const quando = new Date().toLocaleString('pt-BR');
    let y = height - 80;
    const line = (t: string, f = font, size = 12) => {
      aval.drawText(t, { x: 50, y, size, font: f, color: rgb(0.06, 0.09, 0.16) });
      y -= size + 10;
    };
    line('APROVAÇÃO — Plataforma Zoonoses', bold, 16);
    y -= 6;
    line(`Pedido: ${pedidoId}`);
    line(`Aprovado por: ${actor.nome}`);
    line(`Cargo: ${cargo}`);
    line(`Data e hora: ${quando}`);
    line(`Hash de verificação (SHA-256 do original): ${hash}`, font, 9);
    if (comentario) line(`Observação: ${comentario}`);
    const sig = sigImg.scaleToFit(220, 90);
    aval.drawText('Assinatura:', { x: 50, y: y - 20, size: 12, font, color: rgb(0.06, 0.09, 0.16) });
    aval.drawImage(sigImg, { x: 50, y: y - 30 - sig.height, width: sig.width, height: sig.height });

    const out = await pdf.save();
    const path = `pedidos/${pedidoId}/aprovado/aval-${Date.now()}.pdf`;
    const up = await admin.storage.from(BUCKET).upload(path, out, { contentType: 'application/pdf', upsert: true });
    if (up.error) return json(400, { error: up.error.message });

    const { error: rerr } = await admin.rpc('finalizar_aprovacao', {
      p_pedido_id: pedidoId,
      p_analista: user.id,
      p_itens_aprovados: itensAprovados,
      p_comentario: comentario,
      p_storage_path: path,
      p_assinatura_png: assinaturaPng,
      p_hash: hash,
    });
    if (rerr) return json(400, { error: rerr.message });

    return json(200, { ok: true, storage_path: path, hash });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
