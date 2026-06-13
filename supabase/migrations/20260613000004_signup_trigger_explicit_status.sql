-- Torna o contrato de segurança do signup explícito: o trigger grava
-- status='PENDING' e role=null diretamente, em vez de depender do DEFAULT da
-- coluna. Assim, mesmo que o default seja removido no futuro, novos cadastros
-- continuam exigindo aprovação (não viram acesso liberado por engano).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.profiles (id, nome, papel, status, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    'operador',
    'PENDING',
    null
  )
  on conflict (id) do nothing;
  return new;
end; $function$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
