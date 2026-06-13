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
