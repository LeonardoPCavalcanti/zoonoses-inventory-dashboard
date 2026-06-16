-- Cadastro seguro: CPF/telefone em profiles, unicidade parcial, proteção de coluna,
-- validação no banco e RPCs de leitura/escrita controladas.

alter table public.profiles add column if not exists cpf text;
alter table public.profiles add column if not exists telefone text;

-- Validadores IMMUTABLE (defesa em profundidade; a Edge Function também valida).
create or replace function public.cpf_valido(p text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare d text := regexp_replace(coalesce(p,''), '\D', '', 'g'); s int; r int; i int;
begin
  if length(d) <> 11 then return false; end if;
  if d ~ '^(.)\1{10}$' then return false; end if;
  s := 0; for i in 1..9 loop s := s + substr(d,i,1)::int * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(d,10,1)::int then return false; end if;
  s := 0; for i in 1..10 loop s := s + substr(d,i,1)::int * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(d,11,1)::int then return false; end if;
  return true;
end; $$;

create or replace function public.telefone_valido(p text)
returns boolean language sql immutable set search_path = '' as $$
  select regexp_replace(coalesce(p,''), '\D','','g') ~ '^[1-9][0-9](9[0-9]{8}|[2-5][0-9]{7})$';
$$;

-- CHECKs: armazenamento sempre só-dígitos e válido (ou nulo nos registros antigos).
alter table public.profiles drop constraint if exists profiles_cpf_chk;
alter table public.profiles add constraint profiles_cpf_chk
  check (cpf is null or public.cpf_valido(cpf));
alter table public.profiles drop constraint if exists profiles_telefone_chk;
alter table public.profiles add constraint profiles_telefone_chk
  check (telefone is null or public.telefone_valido(telefone));

-- Unicidade parcial: ignora NULL e rejeitados.
create unique index if not exists profiles_cpf_uniq
  on public.profiles (cpf) where cpf is not null and status <> 'REJECTED';
create unique index if not exists profiles_telefone_uniq
  on public.profiles (telefone) where telefone is not null and status <> 'REJECTED';

-- Proteção de coluna: ninguém lê cpf/telefone via PostgREST (o RLS de linha deixa
-- qualquer ativo ler todas as linhas). Como há GRANT SELECT amplo, revogar só a
-- coluna é no-op: revoga-se o SELECT da tabela e concede-se SELECT apenas nas
-- colunas permitidas (todas menos cpf/telefone). cpf/telefone só via RPC definer.
revoke select on public.profiles from authenticated, anon;
grant select (id, nome, papel, created_at, role, status, sector, rejection_note, created_by, last_login_at, nucleo_id)
  on public.profiles to authenticated;

-- Dropdown público de núcleos (a tela de cadastro é anônima).
create or replace function public.nucleos_para_cadastro()
returns table(id uuid, nome text) language sql security definer set search_path = public as $$
  select n.id, n.nome from public.nucleos n order by n.nome;
$$;
revoke execute on function public.nucleos_para_cadastro() from public;
grant execute on function public.nucleos_para_cadastro() to anon, authenticated;

-- Auto-leitura do contato (o usuário não lê as colunas direto).
create or replace function public.meu_contato()
returns table(cpf text, telefone text) language sql security definer set search_path = public as $$
  select p.cpf, p.telefone from public.profiles p where p.id = auth.uid();
$$;
revoke execute on function public.meu_contato() from public, anon;
grant execute on function public.meu_contato() to authenticated;

-- Troca de telefone pelo próprio usuário (admin nunca edita; valida + unicidade).
create or replace function public.atualizar_meu_telefone(p_telefone text)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); d text := regexp_replace(coalesce(p_telefone,''), '\D','','g');
begin
  if actor is null then raise exception 'Não autenticado'; end if;
  if not public.telefone_valido(d) then raise exception 'Telefone inválido'; end if;
  if exists (select 1 from public.profiles where telefone = d and status <> 'REJECTED' and id <> actor) then
    raise exception 'Telefone já cadastrado';
  end if;
  update public.profiles set telefone = d where id = actor;
end; $$;
revoke execute on function public.atualizar_meu_telefone(text) from public, anon;
grant execute on function public.atualizar_meu_telefone(text) to authenticated;

-- admin_list_users estendida (muda o tipo de retorno: precisa DROP + recriar + regrant).
drop function if exists public.admin_list_users();
create function public.admin_list_users()
returns table(id uuid, nome text, email text, cpf text, telefone text, nucleo_nome text,
              role public.user_role, status public.user_status, sector text,
              created_at timestamptz, last_login_at timestamptz)
language sql security definer set search_path = public as $$
  select p.id, p.nome, u.email::text, p.cpf, p.telefone, n.nome,
         p.role, p.status, p.sector, p.created_at, p.last_login_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.nucleos n on n.id = p.nucleo_id
  where public.is_admin()
  order by case p.status when 'PENDING' then 0 else 1 end, p.created_at desc;
$$;
revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
