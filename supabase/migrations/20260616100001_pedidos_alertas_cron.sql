-- Alerta diário de pedidos parados em análise > 5 dias.
-- E-mail é inerte: o http_post só dispara quando app.notify_url/app.notify_key existirem.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.notificar_atrasados()
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ids uuid[];
  v_url text := current_setting('app.notify_url', true);
  v_key text := current_setting('app.notify_key', true);
begin
  select coalesce(array_agg(id), '{}')
    into v_ids
    from public.pedidos
    where status = 'AGUARDANDO_ANALISE'
      and created_at < now() - interval '5 days';

  if array_length(v_ids, 1) is null then
    return 0;
  end if;

  -- Gancho de e-mail (inerte enquanto a config não existir).
  if v_url is not null and v_key is not null then
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
      body := jsonb_build_object('tipo', 'atrasados', 'pedido_ids', to_jsonb(v_ids))
    );
  end if;

  return array_length(v_ids, 1);
end; $$;
revoke execute on function public.notificar_atrasados() from public, anon, authenticated;

-- Agenda diária às 09:00 UTC (idempotente).
select cron.unschedule('notificar-pedidos-atrasados')
  where exists (select 1 from cron.job where jobname = 'notificar-pedidos-atrasados');
select cron.schedule('notificar-pedidos-atrasados', '0 9 * * *', $$select public.notificar_atrasados()$$);
