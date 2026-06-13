-- Auth + RBAC: 5 papéis hierárquicos, status de conta, helpers e RLS por capacidade.

-- 1. Enums novos.
create type user_role as enum (
  'ADMIN', 'FINANCIAL_MANAGER', 'STOCKIST', 'NUCLEUS_SUPERVISOR', 'AUDITOR'
);
create type user_status as enum ('PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED');

-- 2. Colunas novas em profiles.
alter table profiles
  add column role user_role,
  add column status user_status not null default 'PENDING',
  add column sector text,
  add column rejection_note text,
  add column created_by uuid references profiles(id) on delete set null,
  add column last_login_at timestamptz;

-- 3. Backfill: contas existentes já são ativas; mapeia papel -> role.
update profiles set
  status = 'ACTIVE',
  role = case papel when 'admin' then 'ADMIN'::user_role else 'STOCKIST'::user_role end
where role is null;

-- 4. Rank de papel (maior = mais poder).
create or replace function role_rank(r user_role) returns int
language sql immutable as $$
  select case r
    when 'ADMIN' then 5
    when 'FINANCIAL_MANAGER' then 4
    when 'STOCKIST' then 3
    when 'NUCLEUS_SUPERVISOR' then 2
    when 'AUDITOR' then 1
  end;
$$;

-- 5. Helpers de sessão (security definer -> bypassam RLS, sem recursão).
create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status from profiles where id = auth.uid()) = 'ACTIVE', false);
$$;

-- Redefine is_admin() no novo modelo (substitui papel = 'admin').
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()) = 'ADMIN', false);
$$;

create or replace function can_manage_stock() returns boolean
language sql stable security definer set search_path = public as $$
  select is_active() and coalesce(
    (select role from profiles where id = auth.uid()) in ('ADMIN','STOCKIST'), false);
$$;

-- RPC usada pela tela de login para mostrar a mensagem de bloqueio correta.
create or replace function my_account_status() returns user_status
language sql stable security definer set search_path = public as $$
  select status from profiles where id = auth.uid();
$$;
grant execute on function my_account_status() to authenticated;

-- 6. RLS reescrita.
-- profiles: lê o próprio sempre; ativos leem todos (joins de responsável).
drop policy if exists sel_auth on profiles;
create policy sel_self_or_active on profiles for select to authenticated
  using (id = auth.uid() or is_active());

-- update de profile: o próprio (campos não sensíveis) ou admin. Mudança de
-- role/status é mediada por edge function + trigger na Fase 2.
drop policy if exists upd_profile on profiles;
create policy upd_profile on profiles for update to authenticated
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

-- leitura dos dados de negócio exige conta ativa.
drop policy if exists sel_auth on setores;
drop policy if exists sel_auth on categorias;
drop policy if exists sel_auth on fornecedores;
drop policy if exists sel_auth on produtos;
drop policy if exists sel_auth on lotes;
drop policy if exists sel_auth on movimentacoes;
create policy sel_active on setores       for select to authenticated using (is_active());
create policy sel_active on categorias    for select to authenticated using (is_active());
create policy sel_active on fornecedores  for select to authenticated using (is_active());
create policy sel_active on produtos      for select to authenticated using (is_active());
create policy sel_active on lotes         for select to authenticated using (is_active());
create policy sel_active on movimentacoes for select to authenticated using (is_active());

-- escrita no estoque: capacidade manage_stock (ADMIN ou STOCKIST, conta ativa).
drop policy if exists wr_prod on produtos;
drop policy if exists wr_lote on lotes;
drop policy if exists ins_mov on movimentacoes;
create policy wr_prod on produtos for all to authenticated
  using (can_manage_stock()) with check (can_manage_stock());
create policy wr_lote on lotes for all to authenticated
  using (can_manage_stock()) with check (can_manage_stock());
create policy ins_mov on movimentacoes for insert to authenticated
  with check (can_manage_stock());

-- Cadastros base (setores/categorias/fornecedores) seguem com is_admin(),
-- agora avaliado pelo novo modelo de papéis.
