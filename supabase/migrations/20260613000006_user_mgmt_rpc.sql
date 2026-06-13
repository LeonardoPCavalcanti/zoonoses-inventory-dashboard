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
