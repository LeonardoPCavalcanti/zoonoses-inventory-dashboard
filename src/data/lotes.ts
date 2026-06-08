import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import type { Lote } from './types';

/** Lotes de um produto (quantidade é mantida pelas movimentações via trigger). */
export function useLotes(produtoId?: string) {
  return useQuery({
    queryKey: qk.lotes(produtoId),
    enabled: Boolean(produtoId),
    queryFn: async (): Promise<Lote[]> => {
      const { data, error } = await supabase
        .from('lotes')
        .select('*')
        .eq('produto_id', produtoId as string)
        .order('validade', { nullsFirst: false });
      if (error) throw error;
      return data as Lote[];
    },
  });
}

export type LoteInput = {
  produto_id: string;
  codigo: string | null;
  validade: string | null;
};

export function useLoteMutations() {
  const qc = useQueryClient();
  const invalidate = (produtoId?: string) => {
    qc.invalidateQueries({ queryKey: qk.lotes(produtoId) });
    qc.invalidateQueries({ queryKey: qk.lotes() });
    qc.invalidateQueries({ queryKey: qk.estoque });
  };

  const criar = useMutation({
    mutationFn: async (input: LoteInput) => {
      const { error } = await supabase.from('lotes').insert(input);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      invalidate(vars.produto_id);
      toast.success('Lote criado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async ({ id }: { id: string; produto_id: string }) => {
      const { error } = await supabase.from('lotes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      invalidate(vars.produto_id);
      toast.success('Lote removido');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { criar, remover };
}
