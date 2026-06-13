-- prevent_last_admin_change é função de TRIGGER, não deve ser chamável como RPC.
-- Remove a exposição via PostgREST (/rest/v1/rpc/...) para anon e authenticated.
revoke execute on function public.prevent_last_admin_change() from public, anon, authenticated;
