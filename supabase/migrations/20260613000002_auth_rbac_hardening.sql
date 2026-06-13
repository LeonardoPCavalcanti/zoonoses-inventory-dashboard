-- Endurece os helpers de auth (resposta aos advisors do Supabase):
--  - search_path fixo em role_rank;
--  - remove a superfície de RPC para os papéis anon/public, mantendo apenas
--    authenticated (que o RLS precisa para avaliar as policies).

create or replace function role_rank(r user_role) returns int
language sql immutable set search_path = public as $$
  select case r
    when 'ADMIN' then 5
    when 'FINANCIAL_MANAGER' then 4
    when 'STOCKIST' then 3
    when 'NUCLEUS_SUPERVISOR' then 2
    when 'AUDITOR' then 1
  end;
$$;

revoke execute on function auth_role() from public, anon;
revoke execute on function is_active() from public, anon;
revoke execute on function is_admin() from public, anon;
revoke execute on function can_manage_stock() from public, anon;
revoke execute on function my_account_status() from public, anon;

grant execute on function auth_role() to authenticated;
grant execute on function is_active() to authenticated;
grant execute on function is_admin() to authenticated;
grant execute on function can_manage_stock() to authenticated;
grant execute on function my_account_status() to authenticated;
