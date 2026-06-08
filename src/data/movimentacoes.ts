import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import type { Movimentacao, TipoMovimentacao } from './types';

const SELECT_JOIN =
  '*, produto:produtos(id,nome,unidade), responsavel:profiles(id,nome)';

/** Histórico de movimentações (auditoria), mais recentes primeiro. */
export function useMovimentacoes(limit = 100) {
  return useQuery({
    queryKey: qk.movimentacoes,
    queryFn: async (): Promise<Movimentacao[]> => {
      const { data, error } = await supabase
        .from('movimentacoes')
        .select(SELECT_JOIN)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as Movimentacao[];
    },
  });
}

export type MovimentacaoInput = {
  produto_id: string;
  lote_id: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  motivo: string | null;
};

export function useRegistrarMovimentacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MovimentacaoInput) => {
      const { error } = await supabase.from('movimentacoes').insert(input);
      // O trigger no banco rejeita saída além do saldo — propaga a mensagem.
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.movimentacoes });
      qc.invalidateQueries({ queryKey: qk.estoque });
      qc.invalidateQueries({ queryKey: qk.lotes() });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      toast.success('Movimentação registrada');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
