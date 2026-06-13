-- Auto-rejeita cadastros PENDING parados há mais de 7 dias.
create extension if not exists pg_cron;

create or replace function public.expire_pending_users()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
    set status = 'REJECTED',
        rejection_note = coalesce(rejection_note, 'Expirado: aprovação não concluída em 7 dias')
    where status = 'PENDING' and created_at < now() - interval '7 days';
end; $$;
revoke execute on function public.expire_pending_users() from public, anon, authenticated;

-- Agenda diária às 08:00 UTC (idempotente: remove agendamento anterior se existir).
select cron.unschedule('expire-pending-users')
  where exists (select 1 from cron.job where jobname = 'expire-pending-users');
select cron.schedule('expire-pending-users', '0 8 * * *', $$select public.expire_pending_users()$$);
