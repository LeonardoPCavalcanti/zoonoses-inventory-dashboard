-- RLS do módulo de pedidos. Escrita sempre por RPC; políticas cobrem leitura
-- e o INSERT inicial controlado. Sem update direto em pedidos.

-- Helper: pode analisar (aprovar/criticar/rejeitar) = ADMIN ou FINANCIAL_MANAGER.
create or replace function can_approve_orders() returns boolean
language sql stable security definer set search_path = public as $$
  select is_active() and coalesce(
    (select role from profiles where id = auth.uid()) in ('ADMIN','FINANCIAL_MANAGER'), false);
$$;

-- Helper: o núcleo do usuário logado.
create or replace function my_nucleo() returns uuid
language sql stable security definer set search_path = public as $$
  select nucleo_id from profiles where id = auth.uid();
$$;

alter table nucleos enable row level security;
alter table pedidos enable row level security;
alter table pedido_itens enable row level security;
alter table pedido_criticas enable row level security;
alter table pedido_eventos enable row level security;
alter table pedido_documentos enable row level security;

-- nucleos: lê conta ativa; escreve só admin.
create policy sel_active on nucleos for select to authenticated using (is_active());
create policy wr_admin on nucleos for all to authenticated
  using (is_admin()) with check (is_admin());

-- pedidos: visibilidade por papel.
--  analistas/auditor veem tudo; estoquista vê APROVADO/ENVIADO+ (fila);
--  supervisor de núcleo vê só os do próprio núcleo.
create policy sel_pedidos on pedidos for select to authenticated using (
  is_active() and (
    can_approve_orders()
    or auth_role() = 'AUDITOR'
    or (auth_role() = 'STOCKIST' and status in ('APROVADO','ENVIADO','CONCLUIDO','CONCLUIDO_PARCIAL'))
    or (auth_role() = 'NUCLEUS_SUPERVISOR' and nucleo_id = my_nucleo())
    or is_admin()
  )
);

-- Tabelas-filhas: seguem a visibilidade do pedido pai.
create policy sel_itens on pedido_itens for select to authenticated using (
  exists (select 1 from pedidos p where p.id = pedido_id)
);
create policy sel_criticas on pedido_criticas for select to authenticated using (
  exists (select 1 from pedidos p where p.id = pedido_id)
);
create policy sel_eventos on pedido_eventos for select to authenticated using (
  exists (select 1 from pedidos p where p.id = pedido_id)
);
create policy sel_documentos on pedido_documentos for select to authenticated using (
  exists (select 1 from pedidos p where p.id = pedido_id)
);

-- Sem políticas de INSERT/UPDATE/DELETE: toda escrita passa pelas RPCs
-- SECURITY DEFINER (donas do owner, que bypassam RLS). O `exists` acima já é
-- avaliado sob a policy de select de `pedidos`, então a filha herda a regra.

grant execute on function can_approve_orders() to authenticated;
grant execute on function my_nucleo() to authenticated;
