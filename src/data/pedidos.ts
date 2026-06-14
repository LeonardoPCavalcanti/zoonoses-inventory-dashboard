import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import type { Pedido, PedidoCritica, PedidoEvento, PedidoItem } from './types';

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
          `${LIST_SELECT}, criticas:pedido_criticas(*, autor:profiles(id,nome)), eventos:pedido_eventos(*, ator:profiles(id,nome))`,
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
      toast.success(`Pedido ${rows?.[0]?.codigo ?? ''} criado`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Fábrica para as RPCs de transição que recebem só o id (+ payload). */
function useRpcAcao<TArgs extends Record<string, unknown>>(fn: string, sucesso: string) {
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
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useCriticar = () => useRpcAcao<{ p_motivo: string }>('criticar_pedido', 'Crítica enviada');
export const useRejeitar = () => useRpcAcao<{ p_motivo: string }>('rejeitar_pedido', 'Pedido rejeitado');
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
