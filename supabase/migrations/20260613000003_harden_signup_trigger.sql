-- Endurece o trigger de signup (parte do subsistema de auth): fixa search_path
-- e remove a exposição como RPC (gatilhos não precisam de EXECUTE para o papel
-- da sessão; disparam pelo mecanismo de trigger). Comportamento inalterado:
-- novo cadastro continua nascendo com role=null e status=PENDING (aprovação).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.profiles (id, nome, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    'operador'
  )
  on conflict (id) do nothing;
  return new;
end; $function$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
