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
