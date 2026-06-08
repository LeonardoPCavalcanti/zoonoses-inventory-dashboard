import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import type { EstoqueProduto, Produto } from './types';

const SELECT_JOIN =
  '*, categoria:categorias(id,nome), fornecedor:fornecedores(id,nome), setor:setores(id,nome)';

/** Produtos com seus relacionamentos (categoria/fornecedor/setor). */
export function useProdutos() {
  return useQuery({
    queryKey: qk.produtos,
    queryFn: async (): Promise<Produto[]> => {
      const { data, error } = await supabase.from('produtos').select(SELECT_JOIN).order('nome');
      if (error) throw error;
      return data as unknown as Produto[];
    },
  });
}

/** Estoque agregado por produto (view vw_estoque_produto) — base dos alertas. */
export function useEstoque() {
  return useQuery({
    queryKey: qk.estoque,
    queryFn: async (): Promise<EstoqueProduto[]> => {
      const { data, error } = await supabase.from('vw_estoque_produto').select('*').order('nome');
      if (error) throw error;
      return data as EstoqueProduto[];
    },
  });
}

export type ProdutoInput = {
  nome: string;
  categoria_id: string | null;
  fornecedor_id: string | null;
  setor_id: string | null;
  unidade: string;
  estoque_minimo: number;
  ativo?: boolean;
};

export function useProdutoMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.produtos });
    qc.invalidateQueries({ queryKey: qk.estoque });
  };

  const criar = useMutation({
    mutationFn: async (input: ProdutoInput) => {
      const { error } = await supabase.from('produtos').insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Produto criado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<ProdutoInput>) => {
      const { error } = await supabase.from('produtos').update(input).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Produto atualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('produtos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Produto removido');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { criar, atualizar, remover };
}
