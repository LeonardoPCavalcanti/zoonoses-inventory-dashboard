-- Endurecimento pós-advisor:
--  (a) RLS na tabela de sequência — só a função SECURITY DEFINER a acessa, então
--      habilitar RLS sem policies a torna inacessível por PostgREST (correto).
--  (b) remover o EXECUTE default de public/anon nas RPCs e helpers novos, mantendo
--      o grant a authenticated — mesma postura das RPCs de gestão de usuários.

alter table pedido_sequencia enable row level security;

revoke execute on function criar_pedido(text, jsonb, uuid) from public, anon;
revoke execute on function resubmeter_pedido(uuid, text, jsonb) from public, anon;
revoke execute on function criticar_pedido(uuid, text) from public, anon;
revoke execute on function rejeitar_pedido(uuid, text) from public, anon;
revoke execute on function aprovar_pedido(uuid, jsonb, text) from public, anon;
revoke execute on function despachar_pedido(uuid) from public, anon;
revoke execute on function confirmar_entrega_remetente(uuid) from public, anon;
revoke execute on function confirmar_recebimento_destinatario(uuid, jsonb) from public, anon;
revoke execute on function can_approve_orders() from public, anon;
revoke execute on function my_nucleo() from public, anon;
