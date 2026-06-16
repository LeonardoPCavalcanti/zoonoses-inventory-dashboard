import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { storagePath } from '@/pedidos/documentos';
import type { Pedido, PedidoCritica, PedidoDocumento, PedidoEvento, PedidoItem } from './types';

const BUCKET = 'pedidos-documentos';

/** Dispara a Edge Function de e-mail em best-effort (inerte até o SMTP existir). */
function notificar(tipo: 'criacao' | 'critica' | 'aprovacao' | 'rejeicao', pedidoId: string) {
  void supabase.functions.invoke('notificar', { body: { tipo, pedido_id: pedidoId } }).catch(() => {});
}

const LIST_SELECT =
  '*, nucleo:nucleos(id,nome,codigo), solicitante:profiles!pedidos_solicitante_id_fkey(id,nome), itens:pedido_itens(*, produto:produtos(id,nome,unidade))';

export interface PedidoFiltros {
  status?: string;
  nucleoId?: string;
  busca?: string;
}

/** Lista de pedidos — RLS limita as linhas por papel. */
export function usePedidos(filtros: PedidoFiltros = {}) {
  return useQuery({
    queryKey: [...qk.pedidos, filtros] as const,
    queryFn: async (): Promise<Pedido[]> => {
      let q = supabase.from('pedidos').select(LIST_SELECT).order('created_at', { ascending: false });
      if (filtros.status) q = q.eq('status', filtros.status);
      if (filtros.nucleoId) q = q.eq('nucleo_id', filtros.nucleoId);
      if (filtros.busca) q = q.ilike('codigo', `%${filtros.busca}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Pedido[];
    },
  });
}

export interface PedidoDetalhe extends Pedido {
  itens: PedidoItem[];
  criticas: PedidoCritica[];
  eventos: PedidoEvento[];
  documentos: PedidoDocumento[];
}

/** Detalhe completo (itens + críticas + eventos). */
export function usePedido(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.pedido(id) : ['pedido', 'none'],
    enabled: !!id,
    queryFn: async (): Promise<PedidoDetalhe> => {
      const { data, error } = await supabase
        .from('pedidos')
        .select(
          `${LIST_SELECT}, criticas:pedido_criticas(*, autor:profiles(id,nome)), eventos:pedido_eventos(*, ator:profiles(id,nome)), documentos:pedido_documentos(*)`,
        )
        .eq('id', id!)
        .single();
      if (error) throw error;
      const p = data as unknown as PedidoDetalhe;
      p.criticas = [...(p.criticas ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
      p.eventos = [...(p.eventos ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
      return p;
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.pedidos });
    qc.invalidateQueries({ queryKey: qk.pedidoContadores });
  };
}

export interface NovoPedidoInput {
  justificativa: string;
  itens: { produto_id: string; quantidade: number }[];
  nucleo_id?: string;
}

export function useCriarPedido() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: NovoPedidoInput) => {
      const { data, error } = await supabase.rpc('criar_pedido', {
        p_justificativa: input.justificativa,
        p_itens: input.itens,
        p_nucleo_id: input.nucleo_id ?? null,
      });
      if (error) throw error;
      return data as unknown as { id: string; codigo: string }[];
    },
    onSuccess: (rows) => {
      invalidate();
      if (rows?.[0]?.id) notificar('criacao', rows[0].id);
      toast.success(`Pedido ${rows?.[0]?.codigo ?? ''} criado`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Fábrica para as RPCs de transição que recebem só o id (+ payload). */
function useRpcAcao<TArgs extends Record<string, unknown>>(
  fn: string, sucesso: string, posSucesso?: (id: string) => void,
) {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (args: { id: string } & TArgs) => {
      const { id, ...rest } = args;
      const { error } = await supabase.rpc(fn, { p_id: id, ...rest });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      invalidate();
      qc.invalidateQueries({ queryKey: qk.pedido(id) });
      qc.invalidateQueries({ queryKey: qk.estoque });
      qc.invalidateQueries({ queryKey: qk.movimentacoes });
      toast.success(sucesso);
      posSucesso?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useCriticar = () =>
  useRpcAcao<{ p_motivo: string }>('criticar_pedido', 'Crítica enviada', (id) => notificar('critica', id));
export const useRejeitar = () =>
  useRpcAcao<{ p_motivo: string }>('rejeitar_pedido', 'Pedido rejeitado', (id) => notificar('rejeicao', id));
export const useAprovar = () =>
  useRpcAcao<{ p_itens_aprovados: unknown; p_comentario: string | null }>('aprovar_pedido', 'Pedido aprovado');
export const useResubmeter = () =>
  useRpcAcao<{ p_justificativa: string | null; p_itens: unknown }>('resubmeter_pedido', 'Pedido resubmetido');
export const useDespachar = () => useRpcAcao('despachar_pedido', 'Pedido despachado');
export const useConfirmarEntrega = () =>
  useRpcAcao('confirmar_entrega_remetente', 'Entrega confirmada');
export const useConfirmarRecebimento = () =>
  useRpcAcao<{ p_recebidos: unknown }>('confirmar_recebimento_destinatario', 'Recebimento confirmado');

/** Contadores para os badges da sidebar (RLS já filtra por papel). */
export function useContadoresPedidos() {
  return useQuery({
    queryKey: qk.pedidoContadores,
    queryFn: async () => {
      const count = async (status: string) => {
        const { count, error } = await supabase
          .from('pedidos')
          .select('*', { count: 'exact', head: true })
          .eq('status', status);
        if (error) throw error;
        return count ?? 0;
      };
      const [aguardando, enviado] = await Promise.all([count('AGUARDANDO_ANALISE'), count('ENVIADO')]);
      return { aguardando, enviado };
    },
  });
}

/** Pedidos parados em AGUARDANDO_ANALISE há mais que o limite (RLS já filtra por papel). */
export function usePedidosAtrasados(diasLimite = 5) {
  return useQuery({
    queryKey: [...qk.pedidos, 'atrasados', diasLimite] as const,
    queryFn: async (): Promise<Pedido[]> => {
      const limite = new Date(Date.now() - diasLimite * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('pedidos')
        .select(LIST_SELECT)
        .eq('status', 'AGUARDANDO_ANALISE')
        .lt('created_at', limite)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as Pedido[];
    },
  });
}

/** Sobe o documento ORIGINAL e registra na tabela (após criar o pedido). */
export function useUploadDocumento() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ pedidoId, file }: { pedidoId: string; file: File }) => {
      const path = storagePath(pedidoId, 'original', file.name);
      const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (up.error) throw up.error;
      const { error } = await supabase.rpc('registrar_documento', {
        p_pedido_id: pedidoId,
        p_storage_path: path,
        p_filename: file.name,
      });
      if (error) throw error;
      return path;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** URL assinada (1 h) para visualizar/baixar um documento privado. */
export function useDocumentoUrl(storagePathValue: string | undefined) {
  return useQuery({
    queryKey: ['documento-url', storagePathValue],
    enabled: !!storagePathValue,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePathValue!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** Chama a Edge Function que carimba o PDF e finaliza a aprovação. */
export function useAssinarPedido() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (args: {
      pedidoId: string;
      assinaturaPng: string;
      itensAprovados: { item_id: string; qtd: number }[];
      comentario: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke('assinar-pedido', {
        body: {
          pedido_id: args.pedidoId,
          assinatura_png: args.assinaturaPng,
          itens_aprovados: args.itensAprovados,
          comentario: args.comentario,
        },
      });
      if (error) throw error;
      return data as { ok: boolean };
    },
    onSuccess: (_d, args) => {
      invalidate();
      qc.invalidateQueries({ queryKey: qk.pedido(args.pedidoId) });
      toast.success('Pedido aprovado e assinado');
      notificar('aprovacao', args.pedidoId);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
