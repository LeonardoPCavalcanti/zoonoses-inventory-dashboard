import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import type { Categoria, Fornecedor, Setor } from './types';

// ---- Setores ----
export function useSetores() {
  return useQuery({
    queryKey: qk.setores,
    queryFn: async (): Promise<Setor[]> => {
      const { data, error } = await supabase.from('setores').select('*').order('nome');
      if (error) throw error;
      return data as Setor[];
    },
  });
}

// ---- Categorias ----
export function useCategorias() {
  return useQuery({
    queryKey: qk.categorias,
    queryFn: async (): Promise<Categoria[]> => {
      const { data, error } = await supabase.from('categorias').select('*').order('nome');
      if (error) throw error;
      return data as Categoria[];
    },
  });
}

// ---- Fornecedores ----
export function useFornecedores() {
  return useQuery({
    queryKey: qk.fornecedores,
    queryFn: async (): Promise<Fornecedor[]> => {
      const { data, error } = await supabase.from('fornecedores').select('*').order('nome');
      if (error) throw error;
      return data as Fornecedor[];
    },
  });
}

type Tabela = 'setores' | 'categorias' | 'fornecedores';
const keyFor: Record<Tabela, readonly unknown[]> = {
  setores: qk.setores,
  categorias: qk.categorias,
  fornecedores: qk.fornecedores,
};

/** CRUD genérico para os cadastros base (escrita exige papel admin via RLS). */
export function useCadastroMutations(tabela: Tabela) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: keyFor[tabela] });

  const criar = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from(tabela).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Cadastro criado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase.from(tabela).update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Cadastro atualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tabela).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Cadastro removido');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { criar, atualizar, remover };
}
