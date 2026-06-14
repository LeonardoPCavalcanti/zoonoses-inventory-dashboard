-- Hardening de funções-gatilho pré-existentes do controle de estoque.
-- set_responsavel() e aplicar_movimentacao() são trigger functions (RETURNS trigger),
-- não RPCs. Mesmo assim carregavam o grant EXECUTE padrão (anon/authenticated) e
-- search_path mutável, o que o linter do Supabase sinaliza (lints 0011/0028/0029).
--
-- Revogar EXECUTE NÃO impede o gatilho de disparar: triggers executam como dono da
-- tabela, fora da checagem de privilégio EXECUTE (que só vale para chamadas diretas
-- via /rest/v1/rpc). Fixar o search_path elimina o risco de resolução ambígua.

alter function public.aplicar_movimentacao() set search_path = public, pg_temp;
alter function public.set_responsavel() set search_path = public, pg_temp;

revoke execute on function public.aplicar_movimentacao() from public, anon, authenticated;
revoke execute on function public.set_responsavel() from public, anon, authenticated;
