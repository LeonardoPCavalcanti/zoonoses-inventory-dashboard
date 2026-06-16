import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { authRedirectUrl } from '@/auth/redirect';
import type { Role } from '@/auth/roles';
import type { AdminUser, UserAuditEntry } from './types';

export function useAdminUsers() {
  return useQuery({
    queryKey: qk.adminUsers,
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase.rpc('admin_list_users');
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });
}

export function useUserAudit(userId: string | null) {
  return useQuery({
    queryKey: userId ? qk.userAudit(userId) : ['user-audit', 'none'],
    enabled: !!userId,
    queryFn: async (): Promise<UserAuditEntry[]> => {
      const { data, error } = await supabase.rpc('admin_user_audit', { target: userId });
      if (error) throw error;
      return (data ?? []) as UserAuditEntry[];
    },
  });
}

function useUserMutation<T>(
  fn: (vars: T) => Promise<{ error: unknown }>,
  successMsg: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: T) => {
      const { error } = await fn(vars);
      if (error) throw error as Error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.adminUsers });
      toast.success(successMsg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApproveUser() {
  return useUserMutation<{ targetId: string; role: Role; sector?: string | null }>(
    ({ targetId, role, sector }) =>
      supabase.rpc('approve_user', { target_id: targetId, assign_role: role, assign_sector: sector ?? null }),
    'Cadastro aprovado',
  );
}

export function useRejectUser() {
  return useUserMutation<{ targetId: string; note?: string | null }>(
    ({ targetId, note }) => supabase.rpc('reject_user', { target_id: targetId, note: note ?? null }),
    'Cadastro rejeitado',
  );
}

export function useSetUserRole() {
  return useUserMutation<{ targetId: string; role: Role }>(
    ({ targetId, role }) => supabase.rpc('set_user_role', { target_id: targetId, new_role: role }),
    'Papel atualizado',
  );
}

export function useSetUserStatus() {
  return useUserMutation<{ targetId: string; status: 'ACTIVE' | 'INACTIVE' }>(
    ({ targetId, status }) => supabase.rpc('set_user_status', { target_id: targetId, new_status: status }),
    'Status atualizado',
  );
}

export interface CreateUserResult { ok: boolean; userId: string; link: string | null }

/** Criação direta de usuário (Edge Function). Retorna o link de definição de senha. */
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { nome: string; email: string; role: Role; sector?: string | null }): Promise<CreateUserResult> => {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { ...vars, redirectTo: authRedirectUrl() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as CreateUserResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.adminUsers });
      toast.success('Usuário criado');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface NucleoOpcao { id: string; nome: string }

/** Núcleos para o dropdown do cadastro (RPC pública). */
export function useNucleosParaCadastro() {
  return useQuery({
    queryKey: ['nucleos-cadastro'],
    queryFn: async (): Promise<NucleoOpcao[]> => {
      const { data, error } = await supabase.rpc('nucleos_para_cadastro');
      if (error) throw error;
      return (data ?? []) as NucleoOpcao[];
    },
  });
}

export interface CadastroInput {
  nome: string; email: string; senha: string; cpf: string; telefone: string; nucleo_id: string;
}

/** Cadastro público via Edge Function (valida + unicidade + cria conta PENDING). */
export function useCadastrar() {
  return useMutation({
    mutationFn: async (vars: CadastroInput) => {
      const { data, error } = await supabase.functions.invoke('cadastrar', { body: vars });
      if (error) {
        // Erros 4xx da função vêm em error.context (FunctionsHttpError).
        const ctx = (error as { context?: Response }).context;
        if (ctx) { const j = await ctx.json().catch(() => null); if (j?.error) throw new Error(j.error); }
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      return data as { ok: boolean };
    },
  });
}

/** Contato do próprio usuário (cpf/telefone via RPC, pois a coluna é revogada). */
export function useMeuContato() {
  return useQuery({
    queryKey: ['meu-contato'],
    queryFn: async (): Promise<{ cpf: string | null; telefone: string | null }> => {
      const { data, error } = await supabase.rpc('meu_contato');
      if (error) throw error;
      return (data?.[0] ?? { cpf: null, telefone: null });
    },
  });
}

/** Troca o telefone do próprio usuário. */
export function useAtualizarTelefone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (telefone: string) => {
      const { error } = await supabase.rpc('atualizar_meu_telefone', { p_telefone: telefone });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meu-contato'] }); toast.success('Telefone atualizado'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Admin gera link de redefinição de senha de um usuário. */
export function useRedefinirSenha() {
  return useMutation({
    mutationFn: async (targetId: string): Promise<{ link: string | null }> => {
      const { data, error } = await supabase.functions.invoke('admin-redefinir-senha', {
        body: { target_id: targetId, redirectTo: authRedirectUrl() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { link: string | null };
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
