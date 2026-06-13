# Gestão de Usuários — Fase 2a (RPC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o núcleo administrativo de gestão de usuários do Zoonoses — aprovar/rejeitar cadastros pendentes, mudar papel, ativar/desativar e auditar — usando RPC `SECURITY DEFINER` + RLS, sem novas credenciais.

**Architecture:** As mutações administrativas rodam em funções Postgres `SECURITY DEFINER` que recarregam o papel do ator do banco (não confiam no cliente), aplicam hierarquia (`role_rank`), a regra do último-admin, e gravam `user_audit_log` (append-only). O front consome as funções via `supabase.rpc(...)` com React Query, num painel admin protegido por capacidade `manage_users`. Um cadastro PENDING já tem conta auth (senha definida no signup), então aprovar = `status→ACTIVE` + papel, sem e-mail.

**Tech Stack:** Postgres (Supabase) · `SECURITY DEFINER` RPC · RLS · React 18 + Vite + TS · @tanstack/react-query · shadcn/ui · Vitest.

**Escopo fora desta fase (2b, depende de config sua):** criação direta de usuário por convite (Edge Function + service-role), e-mails de notificação/aprovação/rejeição, `expire-pending` via pg_cron, Auth Hook de bloqueio de INACTIVE no login.

**Estado vivo confirmado (2026-06-13):** `profiles` já tem `role/status/sector/rejection_note/created_by/last_login_at`; helpers `role_rank/auth_role/is_active/is_admin/can_manage_stock/my_account_status` existem; `user_audit_log` NÃO existe; `pg_cron` NÃO instalado; usuários: admin (ADMIN/ACTIVE) e demo (STOCKIST/ACTIVE).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/auth/userActions.ts` (criar) | Lógica pura de autorização da UI: pode aprovar? pode mudar papel/status? espelha as regras do banco para habilitar/desabilitar botões. |
| `src/auth/userActions.test.ts` (criar) | Testes Vitest da lógica pura. |
| `supabase/migrations/20260613000005_user_audit_log.sql` (criar) | Tabela append-only + RLS travada (sem policies; acesso só via RPC). |
| `supabase/migrations/20260613000006_user_mgmt_rpc.sql` (criar) | RPCs `approve_user/reject_user/set_user_role/set_user_status/admin_list_users/admin_user_audit` + trigger `prevent_last_admin_change`. |
| `src/data/users.ts` (criar) | Hooks React Query: `useAdminUsers`, mutações `useApproveUser/useRejectUser/useSetUserRole/useSetUserStatus`, `useUserAudit`. |
| `src/data/types.ts` (modificar) | Tipo `AdminUser` e `UserAuditEntry`. |
| `src/lib/queryKeys.ts` (modificar) | Chaves `adminUsers` e `userAudit(id)`. |
| `src/pages/UsuariosAdmin.tsx` (criar) | Painel: abas Usuários/Pendentes, filtros, ações por linha, sheet de auditoria. |
| `src/components/layout/AppShell.tsx` (modificar) | Item de nav "Usuários" visível só com `manage_users`. |
| `src/App.tsx` (modificar) | Rota `/admin/usuarios` protegida por `requireCapability="manage_users"`. |

---

### Task 1: Lógica pura de autorização da UI (`src/auth/userActions.ts`)

**Files:**
- Create: `src/auth/userActions.ts`
- Test: `src/auth/userActions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/auth/userActions.test.ts
import { describe, it, expect } from 'vitest';
import { canApprove, canChangeRole, canChangeStatus } from './userActions';

describe('canApprove', () => {
  it('só ADMIN aprova', () => {
    expect(canApprove('ADMIN')).toBe(true);
    expect(canApprove('FINANCIAL_MANAGER')).toBe(false);
    expect(canApprove(null)).toBe(false);
  });
});

describe('canChangeRole', () => {
  it('ADMIN muda papel de alguém abaixo para outro abaixo', () => {
    expect(canChangeRole('ADMIN', 'STOCKIST', 'AUDITOR', false).ok).toBe(true);
  });
  it('não pode atribuir papel >= ao seu', () => {
    expect(canChangeRole('ADMIN', 'STOCKIST', 'ADMIN', false).ok).toBe(false);
  });
  it('não pode gerenciar alvo de papel igual/superior', () => {
    expect(canChangeRole('ADMIN', 'ADMIN', 'AUDITOR', false).ok).toBe(false);
  });
  it('não pode mudar o próprio papel', () => {
    expect(canChangeRole('ADMIN', 'STOCKIST', 'AUDITOR', true).ok).toBe(false);
  });
  it('não-ADMIN não muda papel', () => {
    expect(canChangeRole('FINANCIAL_MANAGER', 'STOCKIST', 'AUDITOR', false).ok).toBe(false);
  });
});

describe('canChangeStatus', () => {
  it('ADMIN desativa estoquista', () => {
    expect(canChangeStatus('ADMIN', 'STOCKIST', 'INACTIVE', { isSelf: false, isLastActiveAdmin: false }).ok).toBe(true);
  });
  it('bloqueia desativar o último admin ativo', () => {
    expect(canChangeStatus('ADMIN', 'ADMIN', 'INACTIVE', { isSelf: false, isLastActiveAdmin: true }).ok).toBe(false);
  });
  it('não pode mudar o próprio status', () => {
    expect(canChangeStatus('ADMIN', 'STOCKIST', 'INACTIVE', { isSelf: true, isLastActiveAdmin: false }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/auth/userActions.test.ts`
Expected: FAIL — `canApprove` is not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/auth/userActions.ts
import { type Role, ROLE_RANK, hasPermission } from './roles';

export interface Decision { ok: boolean; reason?: string }
const ok: Decision = { ok: true };
const no = (reason: string): Decision => ({ ok: false, reason });

/** Só quem tem manage_users (ADMIN) aprova cadastros. */
export function canApprove(actor: Role | null): boolean {
  return hasPermission(actor, 'manage_users');
}

/** Espelha set_user_role: ator ADMIN, não-self, alvo abaixo, novo papel abaixo. */
export function canChangeRole(
  actor: Role | null,
  target: Role | null,
  newRole: Role,
  isSelf: boolean,
): Decision {
  if (!hasPermission(actor, 'manage_users')) return no('Sem permissão para gerenciar usuários');
  if (isSelf) return no('Você não pode alterar seu próprio papel');
  const a = ROLE_RANK[actor as Role];
  if (target && ROLE_RANK[target] >= a) return no('Usuário de papel igual ou superior');
  if (ROLE_RANK[newRole] >= a) return no('Papel igual ou acima do seu');
  return ok;
}

/** Espelha set_user_status: ator ADMIN, não-self, alvo abaixo, last-admin. */
export function canChangeStatus(
  actor: Role | null,
  target: Role | null,
  newStatus: 'ACTIVE' | 'INACTIVE',
  ctx: { isSelf: boolean; isLastActiveAdmin: boolean },
): Decision {
  if (!hasPermission(actor, 'manage_users')) return no('Sem permissão para gerenciar usuários');
  if (ctx.isSelf) return no('Você não pode alterar seu próprio status');
  const a = ROLE_RANK[actor as Role];
  if (target && ROLE_RANK[target] >= a) return no('Usuário de papel igual ou superior');
  if (newStatus === 'INACTIVE' && target === 'ADMIN' && ctx.isLastActiveAdmin) {
    return no('Não é possível desativar o último administrador ativo');
  }
  return ok;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/auth/userActions.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/auth/userActions.ts src/auth/userActions.test.ts
git commit -m "feat(users): lógica pura de autorização das ações de gestão de usuários"
```

---

### Task 2: Migração — tabela `user_audit_log`

**Files:**
- Create: `supabase/migrations/20260613000005_user_audit_log.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Log append-only de ações administrativas sobre usuários.
-- RLS habilitada SEM policies: todo acesso passa por funções SECURITY DEFINER
-- (admin_user_audit), nunca direto do cliente.
create table if not exists public.user_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id),
  target_id   uuid references public.profiles(id),
  action      text not null,
  from_role   public.user_role,
  to_role     public.user_role,
  from_status public.user_status,
  to_status   public.user_status,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_user_audit_target on public.user_audit_log(target_id, created_at desc);

alter table public.user_audit_log enable row level security;
-- Nenhuma policy: nega acesso direto. Inserts/reads via RPC SECURITY DEFINER.
revoke all on public.user_audit_log from anon, authenticated;
```

- [ ] **Step 2: Apply the migration**

Apply via MCP `apply_migration` (name `user_audit_log`) ao projeto `vkjmewxojzhxillkjfft`.
Expected: success.

- [ ] **Step 3: Verify the table exists and is locked down**

Run via MCP `execute_sql`:
```sql
select
  (select exists(select 1 from information_schema.tables where table_schema='public' and table_name='user_audit_log')) as tbl,
  (select relrowsecurity from pg_class where oid='public.user_audit_log'::regclass) as rls_on,
  (select count(*) from pg_policies where schemaname='public' and tablename='user_audit_log') as policies;
```
Expected: `tbl=true, rls_on=true, policies=0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260613000005_user_audit_log.sql
git commit -m "feat(users): tabela user_audit_log (append-only, RLS travada)"
```

---

### Task 3: Migração — RPCs de gestão + trigger último-admin

**Files:**
- Create: `supabase/migrations/20260613000006_user_mgmt_rpc.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Mutações administrativas como funções SECURITY DEFINER. Cada uma:
-- exige auth.uid(), recarrega o papel do ator do banco, exige ADMIN,
-- aplica hierarquia (role_rank) + last-admin + não-self, e audita.

-- approve_user: PENDING -> ACTIVE + papel atribuído.
create or replace function public.approve_user(target_id uuid, assign_role public.user_role, assign_sector text default null)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); actor_role public.user_role; tgt_status public.user_status;
begin
  if actor is null then raise exception 'Não autenticado'; end if;
  select role into actor_role from public.profiles where id = actor;
  if actor_role is distinct from 'ADMIN' then raise exception 'Apenas administradores podem aprovar cadastros'; end if;
  select status into tgt_status from public.profiles where id = target_id;
  if not found then raise exception 'Usuário não encontrado'; end if;
  if tgt_status <> 'PENDING' then raise exception 'Cadastro não está pendente'; end if;
  if role_rank(assign_role) >= role_rank(actor_role) then raise exception 'Você não pode atribuir um papel igual ou acima do seu'; end if;
  update public.profiles set role = assign_role, status = 'ACTIVE', sector = coalesce(assign_sector, sector) where id = target_id;
  insert into public.user_audit_log(actor_id, target_id, action, to_role, from_status, to_status, note)
    values (actor, target_id, 'approve', assign_role, 'PENDING', 'ACTIVE', assign_sector);
end; $$;

-- reject_user: PENDING -> REJECTED + nota.
create or replace function public.reject_user(target_id uuid, note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); actor_role public.user_role; tgt_status public.user_status;
begin
  if actor is null then raise exception 'Não autenticado'; end if;
  select role into actor_role from public.profiles where id = actor;
  if actor_role is distinct from 'ADMIN' then raise exception 'Apenas administradores podem rejeitar cadastros'; end if;
  select status into tgt_status from public.profiles where id = target_id;
  if not found then raise exception 'Usuário não encontrado'; end if;
  if tgt_status <> 'PENDING' then raise exception 'Cadastro não está pendente'; end if;
  update public.profiles set status = 'REJECTED', rejection_note = note where id = target_id;
  insert into public.user_audit_log(actor_id, target_id, action, from_status, to_status, note)
    values (actor, target_id, 'reject', 'PENDING', 'REJECTED', note);
end; $$;

-- set_user_role: muda papel respeitando hierarquia + last-admin + não-self.
create or replace function public.set_user_role(target_id uuid, new_role public.user_role)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); actor_role public.user_role; old_role public.user_role; tgt_status public.user_status; others int;
begin
  if actor is null then raise exception 'Não autenticado'; end if;
  if actor = target_id then raise exception 'Você não pode alterar seu próprio papel'; end if;
  select role into actor_role from public.profiles where id = actor;
  if actor_role is distinct from 'ADMIN' then raise exception 'Apenas administradores podem alterar papéis'; end if;
  select role, status into old_role, tgt_status from public.profiles where id = target_id;
  if not found then raise exception 'Usuário não encontrado'; end if;
  if old_role is not null and role_rank(old_role) >= role_rank(actor_role) then raise exception 'Você não pode gerenciar um usuário de papel igual ou superior'; end if;
  if role_rank(new_role) >= role_rank(actor_role) then raise exception 'Você não pode atribuir um papel igual ou acima do seu'; end if;
  if old_role = 'ADMIN' and tgt_status = 'ACTIVE' and new_role <> 'ADMIN' then
    select count(*) into others from public.profiles where role='ADMIN' and status='ACTIVE' and id <> target_id;
    if others = 0 then raise exception 'Não é possível rebaixar o último administrador ativo'; end if;
  end if;
  update public.profiles set role = new_role where id = target_id;
  insert into public.user_audit_log(actor_id, target_id, action, from_role, to_role)
    values (actor, target_id, 'set_role', old_role, new_role);
end; $$;

-- set_user_status: ACTIVE/INACTIVE (soft delete) com as mesmas proteções.
create or replace function public.set_user_status(target_id uuid, new_status public.user_status)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); actor_role public.user_role; old_role public.user_role; old_status public.user_status; others int;
begin
  if actor is null then raise exception 'Não autenticado'; end if;
  if actor = target_id then raise exception 'Você não pode alterar seu próprio status'; end if;
  if new_status not in ('ACTIVE','INACTIVE') then raise exception 'Status inválido para esta ação'; end if;
  select role into actor_role from public.profiles where id = actor;
  if actor_role is distinct from 'ADMIN' then raise exception 'Apenas administradores podem alterar status'; end if;
  select role, status into old_role, old_status from public.profiles where id = target_id;
  if not found then raise exception 'Usuário não encontrado'; end if;
  if old_role is not null and role_rank(old_role) >= role_rank(actor_role) then raise exception 'Você não pode gerenciar um usuário de papel igual ou superior'; end if;
  if old_role = 'ADMIN' and old_status = 'ACTIVE' and new_status = 'INACTIVE' then
    select count(*) into others from public.profiles where role='ADMIN' and status='ACTIVE' and id <> target_id;
    if others = 0 then raise exception 'Não é possível desativar o último administrador ativo'; end if;
  end if;
  update public.profiles set status = new_status where id = target_id;
  insert into public.user_audit_log(actor_id, target_id, action, from_status, to_status)
    values (actor, target_id, 'set_status', old_status, new_status);
end; $$;

-- admin_list_users: lista com e-mail (de auth.users). Só ADMIN vê linhas.
create or replace function public.admin_list_users()
returns table(id uuid, nome text, email text, role public.user_role, status public.user_status, sector text, created_at timestamptz, last_login_at timestamptz)
language sql security definer set search_path = public as $$
  select p.id, p.nome, u.email::text, p.role, p.status, p.sector, p.created_at, p.last_login_at
  from public.profiles p join auth.users u on u.id = p.id
  where public.is_admin()
  order by case p.status when 'PENDING' then 0 else 1 end, p.created_at desc;
$$;

-- admin_user_audit: histórico de um usuário (ADMIN ou AUDITOR).
create or replace function public.admin_user_audit(target uuid)
returns setof public.user_audit_log
language sql security definer set search_path = public as $$
  select * from public.user_audit_log
  where (public.is_admin() or public.auth_role() = 'AUDITOR') and target_id = target
  order by created_at desc;
$$;

-- Defesa em profundidade: o banco nunca fica sem um admin ativo.
create or replace function public.prevent_last_admin_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare others int;
begin
  if old.role = 'ADMIN' and old.status = 'ACTIVE'
     and (new.role is distinct from 'ADMIN' or new.status <> 'ACTIVE') then
    select count(*) into others from public.profiles where role='ADMIN' and status='ACTIVE' and id <> old.id;
    if others = 0 then raise exception 'Operação bloqueada: deve existir ao menos um administrador ativo'; end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_prevent_last_admin on public.profiles;
create trigger trg_prevent_last_admin before update on public.profiles
  for each row execute function public.prevent_last_admin_change();

-- Permissões: nega anon/public, libera só authenticated nas RPC chamáveis.
revoke execute on function public.approve_user(uuid, public.user_role, text) from public, anon;
revoke execute on function public.reject_user(uuid, text) from public, anon;
revoke execute on function public.set_user_role(uuid, public.user_role) from public, anon;
revoke execute on function public.set_user_status(uuid, public.user_status) from public, anon;
revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.admin_user_audit(uuid) from public, anon;
grant execute on function public.approve_user(uuid, public.user_role, text) to authenticated;
grant execute on function public.reject_user(uuid, text) to authenticated;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;
grant execute on function public.set_user_status(uuid, public.user_status) to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_user_audit(uuid) to authenticated;
```

- [ ] **Step 2: Apply the migration**

Apply via MCP `apply_migration` (name `user_mgmt_rpc`).
Expected: success.

- [ ] **Step 3: Verify guards (sem autenticação) e trigger**

Run via MCP `execute_sql` — o ator é o service role (auth.uid() nulo), então as RPCs devem rejeitar:
```sql
do $$ begin
  begin perform public.approve_user('00000000-0000-0000-0000-000000000000','STOCKIST');
        raise exception 'FALHOU: approve_user não barrou'; exception when others then null; end;
  -- trigger: tentar desativar o único admin ativo deve falhar (rollback automático do bloco)
  begin
    update public.profiles set status='INACTIVE' where role='ADMIN' and status='ACTIVE';
    raise exception 'FALHOU: trigger last-admin não barrou';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  raise notice 'OK: guards e trigger ativos';
end $$;
```
Expected: NOTICE `OK: guards e trigger ativos` (nenhuma exceção `FALHOU%`).

- [ ] **Step 4: Verify advisors**

Run MCP `get_advisors` (type `security`). Expected: as novas funções têm `search_path` setado e não estão liberadas para anon (sem novos WARNINGs além dos pré-existentes de `set_responsavel`/`aplicar_movimentacao`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260613000006_user_mgmt_rpc.sql
git commit -m "feat(users): RPCs de aprovação/papel/status + trigger último-admin"
```

---

### Task 4: Camada de dados (`src/data/users.ts`)

**Files:**
- Modify: `src/data/types.ts` (adicionar `AdminUser`, `UserAuditEntry`)
- Modify: `src/lib/queryKeys.ts` (adicionar `adminUsers`, `userAudit`)
- Create: `src/data/users.ts`

- [ ] **Step 1: Add types**

Em `src/data/types.ts`, ao final:
```ts
export interface AdminUser {
  id: string;
  nome: string;
  email: string;
  role: Role | null;
  status: UserStatus;
  sector: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface UserAuditEntry {
  id: string;
  actor_id: string | null;
  target_id: string | null;
  action: string;
  from_role: Role | null;
  to_role: Role | null;
  from_status: UserStatus | null;
  to_status: UserStatus | null;
  note: string | null;
  created_at: string;
}
```
(`Role` já é re-exportado de `@/auth/roles` neste arquivo; confirme o import existente no topo.)

- [ ] **Step 2: Add query keys**

Em `src/lib/queryKeys.ts`, dentro do objeto `qk`:
```ts
  adminUsers: ['admin-users'] as const,
  userAudit: (id: string) => ['user-audit', id] as const,
```

- [ ] **Step 3: Write the data hooks**

```ts
// src/data/users.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
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
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/data/types.ts src/lib/queryKeys.ts src/data/users.ts
git commit -m "feat(users): camada de dados (RPC) para o painel admin"
```

---

### Task 5: Painel admin (`src/pages/UsuariosAdmin.tsx`)

**Files:**
- Create: `src/pages/UsuariosAdmin.tsx`

Página com duas abas (shadcn `Tabs`): **Pendentes** (fila com Aprovar/Rejeitar) e **Usuários** (todos, com filtro por papel/status, dropdown de papel, ativar/desativar, e botão "Auditoria" abrindo um `Sheet`). Usa `ROLE_LABEL`, `assignableRoles`, `STATUS_MESSAGE`, e as decisões puras de `userActions.ts` para desabilitar ações inválidas. O `useAuth().profile` dá o ator (papel + id) e o cálculo de `isLastActiveAdmin` (a partir da lista carregada).

- [ ] **Step 1: Write the page**

```tsx
// src/pages/UsuariosAdmin.tsx
import { useMemo, useState } from 'react';
import { Loader2, ShieldCheck, History } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Empty } from '@/components/shared/states';
import { useAuth } from '@/auth/AuthProvider';
import { ROLE_LABEL, assignableRoles, type Role } from '@/auth/roles';
import { canChangeRole, canChangeStatus } from '@/auth/userActions';
import {
  useAdminUsers, useUserAudit, useApproveUser, useRejectUser,
  useSetUserRole, useSetUserStatus,
} from '@/data/users';
import type { AdminUser, UserStatus } from '@/data/types';

const STATUS_BADGE: Record<UserStatus, string> = {
  ACTIVE: 'bg-primary/10 text-primary',
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  INACTIVE: 'bg-muted text-muted-foreground',
  REJECTED: 'bg-destructive/10 text-destructive',
};
const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: 'Ativo', PENDING: 'Pendente', INACTIVE: 'Inativo', REJECTED: 'Rejeitado',
};

export default function UsuariosAdmin() {
  const { profile } = useAuth();
  const actorRole = profile?.role ?? null;
  const actorId = profile?.id ?? null;
  const { data: users = [], isLoading } = useAdminUsers();

  const activeAdmins = users.filter((u) => u.role === 'ADMIN' && u.status === 'ACTIVE').length;
  const pendentes = users.filter((u) => u.status === 'PENDING');
  const geral = users.filter((u) => u.status !== 'PENDING');

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">Aprovação de cadastros e gestão de acesso.</p>
      </div>

      <Tabs defaultValue={pendentes.length ? 'pendentes' : 'todos'}>
        <TabsList>
          <TabsTrigger value="pendentes">
            Pendentes{pendentes.length > 0 && <Badge className="ml-2" variant="secondary">{pendentes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="mt-4">
          <PendingQueue users={pendentes} actorRole={actorRole} />
        </TabsContent>

        <TabsContent value="todos" className="mt-4">
          <UserTable users={geral} actorRole={actorRole} actorId={actorId} activeAdmins={activeAdmins} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PendingQueue({ users, actorRole }: { users: AdminUser[]; actorRole: Role | null }) {
  const approve = useApproveUser();
  const reject = useRejectUser();
  const [approving, setApproving] = useState<AdminUser | null>(null);
  const [role, setRole] = useState<Role | ''>('');
  const options = assignableRoles(actorRole);

  if (!users.length) return <Empty title="Nenhum cadastro pendente" description="Novas solicitações de acesso aparecem aqui." />;

  return (
    <>
      <Card>
        <CardContent className="divide-y p-0">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{u.nome}</p>
                <p className="text-sm text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { setApproving(u); setRole(''); }}>Aprovar</Button>
                <Button size="sm" variant="outline" disabled={reject.isPending}
                  onClick={() => reject.mutate({ targetId: u.id })}>Rejeitar</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aprovar {approving?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Papel</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue placeholder="Selecione o papel" /></SelectTrigger>
              <SelectContent>
                {options.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproving(null)}>Cancelar</Button>
            <Button disabled={!role || approve.isPending}
              onClick={() => approving && role &&
                approve.mutate({ targetId: approving.id, role }, { onSuccess: () => setApproving(null) })}>
              {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar aprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function UserTable({
  users, actorRole, actorId, activeAdmins,
}: { users: AdminUser[]; actorRole: Role | null; actorId: string | null; activeAdmins: number }) {
  const setRole = useSetUserRole();
  const setStatus = useSetUserStatus();
  const [q, setQ] = useState('');
  const [auditFor, setAuditFor] = useState<AdminUser | null>(null);

  const filtered = useMemo(
    () => users.filter((u) =>
      [u.nome, u.email].some((s) => s.toLowerCase().includes(q.toLowerCase()))),
    [users, q],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Todos os usuários</CardTitle>
        <Input placeholder="Buscar por nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} className="mt-2 max-w-xs" />
      </CardHeader>
      <CardContent className="divide-y p-0">
        {filtered.map((u) => {
          const isSelf = u.id === actorId;
          const roleOpts = assignableRoles(actorRole);
          const lastAdmin = u.role === 'ADMIN' && u.status === 'ACTIVE' && activeAdmins <= 1;
          const canDeactivate = canChangeStatus(actorRole, u.role, 'INACTIVE', { isSelf, isLastActiveAdmin: lastAdmin }).ok;
          const canActivate = canChangeStatus(actorRole, u.role, 'ACTIVE', { isSelf, isLastActiveAdmin: false }).ok;
          return (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  {u.nome}
                  {u.role === 'ADMIN' && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                </p>
                <p className="truncate text-sm text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={STATUS_BADGE[u.status]} variant="secondary">{STATUS_LABEL[u.status]}</Badge>
                <Select
                  value={u.role ?? ''}
                  onValueChange={(v) => setRole.mutate({ targetId: u.id, role: v as Role })}
                  disabled={isSelf || !canChangeRole(actorRole, u.role, (roleOpts[0] ?? 'AUDITOR'), isSelf).ok}
                >
                  <SelectTrigger className="h-8 w-44"><SelectValue placeholder={u.role ? ROLE_LABEL[u.role] : 'Sem papel'} /></SelectTrigger>
                  <SelectContent>
                    {roleOpts.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
                {u.status === 'ACTIVE' ? (
                  <Button size="sm" variant="outline" disabled={!canDeactivate || setStatus.isPending}
                    onClick={() => setStatus.mutate({ targetId: u.id, status: 'INACTIVE' })}>Desativar</Button>
                ) : (
                  <Button size="sm" variant="outline" disabled={!canActivate || u.status === 'REJECTED' || setStatus.isPending}
                    onClick={() => setStatus.mutate({ targetId: u.id, status: 'ACTIVE' })}>Ativar</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setAuditFor(u)} aria-label="Ver auditoria">
                  <History className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {!filtered.length && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</div>}
      </CardContent>

      <AuditSheet user={auditFor} onClose={() => setAuditFor(null)} />
    </Card>
  );
}

function AuditSheet({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const { data: entries = [], isLoading } = useUserAudit(user?.id ?? null);
  return (
    <Sheet open={!!user} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader><SheetTitle>Auditoria — {user?.nome}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-3">
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {!isLoading && !entries.length && <p className="text-sm text-muted-foreground">Sem registros.</p>}
          {entries.map((e) => (
            <div key={e.id} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{e.action}</p>
              <p className="text-muted-foreground">
                {[e.from_role && `${e.from_role}→${e.to_role}`, e.from_status && `${e.from_status}→${e.to_status}`, e.note]
                  .filter(Boolean).join(' · ')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString('pt-BR')}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Confirm shadcn primitives exist**

Run: `ls src/components/ui/tabs.tsx src/components/ui/sheet.tsx src/components/ui/dialog.tsx src/components/ui/select.tsx src/components/ui/badge.tsx`
Expected: todos existem. Se algum faltar, gere com `npx shadcn@latest add tabs sheet dialog select badge`. Confirme também `@/components/shared/states` exporta `Empty` (senão, ajuste o import/uso).

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/UsuariosAdmin.tsx
git commit -m "feat(users): painel admin (pendentes, gestão, auditoria)"
```

---

### Task 6: Rota + navegação por capacidade

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/AppShell.tsx`

- [ ] **Step 1: Add the route**

Em `src/App.tsx`, importar e adicionar antes de `path="*"`:
```tsx
import UsuariosAdmin from '@/pages/UsuariosAdmin';
// ...
<Route path="/admin/usuarios" element={<Protected requireCapability="manage_users"><UsuariosAdmin /></Protected>} />
```
Atualize o componente `Protected` para repassar a prop:
```tsx
function Protected({ children, requireCapability }: { children: ReactNode; requireCapability?: Capability }) {
  return (
    <ProtectedRoute requireCapability={requireCapability}>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
```
E importe o tipo: `import type { Capability } from '@/auth/roles';`

- [ ] **Step 2: Gate the nav item**

Em `src/components/layout/AppShell.tsx`:
```tsx
import { Users } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { ROLE_LABEL, type Capability } from '@/auth/roles';

const nav: { to: string; label: string; icon: typeof Users; end?: boolean; cap?: Capability }[] = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/produtos', label: 'Produtos', icon: Package },
  { to: '/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
  { to: '/auditoria', label: 'Auditoria', icon: History },
  { to: '/cadastros', label: 'Cadastros', icon: Settings2 },
  { to: '/admin/usuarios', label: 'Usuários', icon: Users, cap: 'manage_users' },
];
```
No componente, derive a lista visível:
```tsx
const { profile, signOut, can } = useAuth();
const visibleNav = nav.filter((n) => !n.cap || can(n.cap));
```
E troque `nav.map(...)` por `visibleNav.map(...)` (inclusive no cálculo de `titulo`).

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors; build success.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/layout/AppShell.tsx
git commit -m "feat(users): rota /admin/usuarios e nav condicionada a manage_users"
```

---

### Task 7: Verificação final + walkthrough ao vivo

**Files:** none (verificação)

- [ ] **Step 1: Full suite**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: todos os testes verdes (incl. `userActions`), tsc/lint limpos, build ok.

- [ ] **Step 2: E2E como admin (Playwright ou manual)**

Criar um cadastro PENDING de teste (via `/cadastrar` com e-mail descartável ou inserindo um auth user de teste), logar como admin (`admin@zoonoses.app`), ir em `/admin/usuarios`:
1. Aba **Pendentes** mostra o cadastro → **Aprovar** com papel `AUDITOR` → some da fila, aparece em **Todos** como Ativo/Auditor.
2. Aba **Todos**: trocar papel, **Desativar**/**Ativar**, abrir **Auditoria** (deve listar approve + set_role + set_status).
3. Confirmar que o item de nav "Usuários" NÃO aparece logando como demo (STOCKIST).
4. Limpar o usuário de teste ao final.

- [ ] **Step 3: Confirm no security regressions**

Run MCP `get_advisors` (security). Expected: sem novos WARNINGs atribuíveis às funções desta fase.

- [ ] **Step 4: Final commit (se houver ajuste do walkthrough)**

```bash
git add -A && git commit -m "test(users): verificação E2E do painel de gestão"
```

---

## Self-Review

**Spec coverage (Fase 2 do design):** painel admin ✓ (Task 5), fila de aprovação ✓ (PendingQueue), editar papel ✓ (set_user_role), ativar/desativar ✓ (set_user_status), auditoria ✓ (user_audit_log + AuditSheet), `user_audit_log` ✓ (Task 2), trigger last-admin ✓ (Task 3), gating de navegação ✓ (Task 6). **Diferido p/ 2b (documentado):** `admin-create-user`/convite, e-mails, `expire-pending` (pg_cron), `/admin/usuarios/novo`. Rotas `/pendentes` e `/:id/auditoria` do spec consolidadas em abas + Sheet na mesma página (decisão de simplificação; mesmo comportamento).

**Type consistency:** `approve_user(target_id, assign_role, assign_sector)`, `set_user_role(target_id, new_role)`, `set_user_status(target_id, new_status)` — nomes de parâmetro idênticos entre SQL (Task 3) e `supabase.rpc` (Task 4). `AdminUser`/`UserAuditEntry` definidos na Task 4 e consumidos na Task 5. `canChangeRole/canChangeStatus` assinaturas idênticas entre Task 1 e Task 5.

**Placeholders:** nenhum — todo código presente.
```