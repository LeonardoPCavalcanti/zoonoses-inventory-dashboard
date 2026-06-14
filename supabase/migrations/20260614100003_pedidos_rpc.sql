-- RPCs do workflow de pedidos. Disciplina idêntica ao user_mgmt_rpc.

-- Gera o próximo código PED-AAAA-NNNN sob lock da linha do ano.
create or replace function proximo_codigo_pedido() returns text
language plpgsql security definer set search_path = public as $$
declare v_ano int := extract(year from now())::int; n int;
begin
  insert into pedido_sequencia(ano, ultimo) values (v_ano, 1)
    on conflict (ano) do update set ultimo = pedido_sequencia.ultimo + 1
    returning ultimo into n;
  return 'PED-' || v_ano || '-' || lpad(n::text, 4, '0');
end; $$;

-- criar_pedido: núcleo solicita; itens = jsonb [{produto_id, quantidade}].
create or replace function criar_pedido(p_justificativa text, p_itens jsonb, p_nucleo_id uuid default null)
returns table(id uuid, codigo text)
language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); actor_role user_role; nucleo uuid; novo_id uuid; novo_codigo text; item jsonb;
begin
  if actor is null then raise exception 'Não autenticado'; end if;
  select role into actor_role from profiles where id = actor;
  if actor_role not in ('NUCLEUS_SUPERVISOR','ADMIN') then
    raise exception 'Apenas supervisores de núcleo podem criar pedidos';
  end if;
  nucleo := coalesce(p_nucleo_id, (select nucleo_id from profiles where id = actor));
  if nucleo is null then raise exception 'Usuário sem núcleo vinculado'; end if;
  if p_justificativa is null or length(trim(p_justificativa)) = 0 then
    raise exception 'Justificativa é obrigatória';
  end if;
  if jsonb_array_length(p_itens) = 0 then raise exception 'Inclua ao menos um item'; end if;

  novo_codigo := proximo_codigo_pedido();
  insert into pedidos(codigo, justificativa, nucleo_id, solicitante_id)
    values (novo_codigo, p_justificativa, nucleo, actor) returning pedidos.id into novo_id;

  for item in select * from jsonb_array_elements(p_itens) loop
    insert into pedido_itens(pedido_id, produto_id, qtd_solicitada)
      values (novo_id, (item->>'produto_id')::uuid, (item->>'quantidade')::int);
  end loop;

  insert into pedido_eventos(pedido_id, tipo, ator_id) values (novo_id, 'CRIADO', actor);
  return query select novo_id, novo_codigo;
end; $$;

-- resubmeter_pedido: dono, só EM_REVISAO. Atualiza justificativa/itens e reabre.
create or replace function resubmeter_pedido(p_id uuid, p_justificativa text default null, p_itens jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); ped pedidos%rowtype; item jsonb;
begin
  if actor is null then raise exception 'Não autenticado'; end if;
  select * into ped from pedidos where id = p_id;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if ped.solicitante_id <> actor then raise exception 'Só o solicitante pode resubmeter'; end if;
  if ped.status <> 'EM_REVISAO' then raise exception 'Pedido não está em revisão'; end if;
  if p_justificativa is not null then update pedidos set justificativa = p_justificativa where id = p_id; end if;
  if p_itens is not null then
    delete from pedido_itens where pedido_id = p_id;
    for item in select * from jsonb_array_elements(p_itens) loop
      insert into pedido_itens(pedido_id, produto_id, qtd_solicitada)
        values (p_id, (item->>'produto_id')::uuid, (item->>'quantidade')::int);
    end loop;
  end if;
  update pedidos set status = 'AGUARDANDO_ANALISE', updated_at = now() where id = p_id;
  insert into pedido_eventos(pedido_id, tipo, ator_id) values (p_id, 'RESUBMETIDO', actor);
end; $$;

-- criticar_pedido: approve_orders; AGUARDANDO_ANALISE -> EM_REVISAO + crítica.
create or replace function criticar_pedido(p_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); st pedido_status;
begin
  if actor is null then raise exception 'Não autenticado'; end if;
  if not can_approve_orders() then raise exception 'Sem permissão para analisar pedidos'; end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then raise exception 'Motivo da crítica é obrigatório'; end if;
  select status into st from pedidos where id = p_id;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if st <> 'AGUARDANDO_ANALISE' then raise exception 'Pedido não está aguardando análise'; end if;
  insert into pedido_criticas(pedido_id, autor_id, motivo) values (p_id, actor, p_motivo);
  update pedidos set status = 'EM_REVISAO', analista_id = actor, devolvido_em = now(), updated_at = now() where id = p_id;
  insert into pedido_eventos(pedido_id, tipo, ator_id, dados) values (p_id, 'CRITICADO', actor, jsonb_build_object('motivo', p_motivo));
end; $$;

-- rejeitar_pedido: approve_orders; -> REJEITADO definitivo.
create or replace function rejeitar_pedido(p_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); st pedido_status;
begin
  if actor is null then raise exception 'Não autenticado'; end if;
  if not can_approve_orders() then raise exception 'Sem permissão para analisar pedidos'; end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then raise exception 'Motivo da rejeição é obrigatório'; end if;
  select status into st from pedidos where id = p_id;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if st not in ('AGUARDANDO_ANALISE','EM_REVISAO') then raise exception 'Pedido não pode ser rejeitado neste status'; end if;
  update pedidos set status = 'REJEITADO', analista_id = actor, analisado_em = now(), devolvido_em = now(), updated_at = now() where id = p_id;
  insert into pedido_eventos(pedido_id, tipo, ator_id, dados) values (p_id, 'REJEITADO', actor, jsonb_build_object('motivo', p_motivo));
end; $$;

-- aprovar_pedido (PROVISÓRIO Fase 1 — sem PDF; substituído na Fase 2 por
-- finalizar_aprovacao via Edge Function). itens_aprovados = [{item_id, qtd}].
create or replace function aprovar_pedido(p_id uuid, p_itens_aprovados jsonb, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); st pedido_status; item jsonb;
begin
  if actor is null then raise exception 'Não autenticado'; end if;
  if not can_approve_orders() then raise exception 'Sem permissão para analisar pedidos'; end if;
  select status into st from pedidos where id = p_id;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if st <> 'AGUARDANDO_ANALISE' then raise exception 'Pedido não está aguardando análise'; end if;
  for item in select * from jsonb_array_elements(p_itens_aprovados) loop
    update pedido_itens set qtd_aprovada = (item->>'qtd')::int
      where id = (item->>'item_id')::uuid and pedido_id = p_id;
  end loop;
  -- Itens sem qtd informada herdam a quantidade solicitada.
  update pedido_itens set qtd_aprovada = qtd_solicitada where pedido_id = p_id and qtd_aprovada is null;
  update pedidos set status = 'APROVADO', analista_id = actor, analisado_em = now(), devolvido_em = now(), updated_at = now() where id = p_id;
  insert into pedido_eventos(pedido_id, tipo, ator_id, dados) values (p_id, 'APROVADO', actor, jsonb_build_object('comentario', p_comentario));
end; $$;

-- despachar_pedido: estoquista; APROVADO -> ENVIADO. Debita estoque FEFO.
create or replace function despachar_pedido(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); st pedido_status; it record; restante int; l record;
begin
  if actor is null then raise exception 'Não autenticado'; end if;
  if not can_manage_stock() then raise exception 'Apenas o estoque pode despachar'; end if;
  select status into st from pedidos where id = p_id;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if st <> 'APROVADO' then raise exception 'Pedido não está aprovado'; end if;

  -- Para cada item, consome lotes por validade (FEFO) inserindo saídas.
  for it in select produto_id, coalesce(qtd_aprovada, qtd_solicitada) as qtd from pedido_itens where pedido_id = p_id loop
    restante := it.qtd;
    for l in select id, quantidade from lotes where produto_id = it.produto_id and quantidade > 0
             order by validade nulls last, created_at loop
      exit when restante <= 0;
      if l.quantidade >= restante then
        insert into movimentacoes(produto_id, lote_id, tipo, quantidade, motivo)
          values (it.produto_id, l.id, 'saida', restante, 'Despacho de pedido');
        restante := 0;
      else
        insert into movimentacoes(produto_id, lote_id, tipo, quantidade, motivo)
          values (it.produto_id, l.id, 'saida', l.quantidade, 'Despacho de pedido');
        restante := restante - l.quantidade;
      end if;
    end loop;
    if restante > 0 then raise exception 'Estoque insuficiente para o produto %', it.produto_id; end if;
  end loop;

  update pedidos set status = 'ENVIADO', enviado_por = actor, enviado_em = now(), updated_at = now() where id = p_id;
  insert into pedido_eventos(pedido_id, tipo, ator_id) values (p_id, 'ENVIADO', actor);
end; $$;

-- Fecha o pedido quando as duas confirmações de entrega existem.
create or replace function _talvez_concluir_pedido(p_id uuid, actor uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ped pedidos%rowtype; parcial boolean;
begin
  select * into ped from pedidos where id = p_id;
  if ped.entrega_remetente_em is not null and ped.entrega_destinatario_em is not null then
    select exists(
      select 1 from pedido_itens where pedido_id = p_id
        and coalesce(qtd_recebida, 0) < coalesce(qtd_aprovada, qtd_solicitada)
    ) into parcial;
    update pedidos set status = (case when parcial then 'CONCLUIDO_PARCIAL' else 'CONCLUIDO' end)::pedido_status,
      updated_at = now() where id = p_id;
    insert into pedido_eventos(pedido_id, tipo, ator_id, dados)
      values (p_id, 'CONCLUIDO', actor, jsonb_build_object('parcial', parcial));
  end if;
end; $$;

-- confirmar_entrega_remetente: estoquista; ENVIADO; marca o lado do remetente.
create or replace function confirmar_entrega_remetente(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); st pedido_status;
begin
  if actor is null then raise exception 'Não autenticado'; end if;
  if not can_manage_stock() then raise exception 'Apenas o estoque confirma a entrega (remetente)'; end if;
  select status into st from pedidos where id = p_id;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if st <> 'ENVIADO' then raise exception 'Pedido não está em trânsito'; end if;
  update pedidos set entrega_remetente_por = actor, entrega_remetente_em = now(), updated_at = now() where id = p_id;
  insert into pedido_eventos(pedido_id, tipo, ator_id, dados) values (p_id, 'ENTREGA_CONFIRMADA', actor, jsonb_build_object('parte','remetente'));
  perform _talvez_concluir_pedido(p_id, actor);
end; $$;

-- confirmar_recebimento_destinatario: núcleo dono; ENVIADO; quantidades recebidas.
-- recebidos = [{item_id, qtd}].
create or replace function confirmar_recebimento_destinatario(p_id uuid, p_recebidos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); ped pedidos%rowtype; item jsonb;
begin
  if actor is null then raise exception 'Não autenticado'; end if;
  select * into ped from pedidos where id = p_id;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if ped.nucleo_id is distinct from my_nucleo() then raise exception 'Só o núcleo solicitante confirma o recebimento'; end if;
  if ped.status <> 'ENVIADO' then raise exception 'Pedido não está em trânsito'; end if;
  for item in select * from jsonb_array_elements(p_recebidos) loop
    update pedido_itens set qtd_recebida = (item->>'qtd')::int
      where id = (item->>'item_id')::uuid and pedido_id = p_id;
  end loop;
  update pedido_itens set qtd_recebida = coalesce(qtd_aprovada, qtd_solicitada) where pedido_id = p_id and qtd_recebida is null;
  update pedidos set entrega_destinatario_por = actor, entrega_destinatario_em = now(), updated_at = now() where id = p_id;
  insert into pedido_eventos(pedido_id, tipo, ator_id, dados) values (p_id, 'ENTREGA_CONFIRMADA', actor, jsonb_build_object('parte','destinatario'));
  perform _talvez_concluir_pedido(p_id, actor);
end; $$;

-- Grants: nega anon/public, libera authenticated nas RPCs chamáveis.
revoke execute on function proximo_codigo_pedido() from public, anon;
revoke execute on function _talvez_concluir_pedido(uuid, uuid) from public, anon, authenticated;
grant execute on function criar_pedido(text, jsonb, uuid) to authenticated;
grant execute on function resubmeter_pedido(uuid, text, jsonb) to authenticated;
grant execute on function criticar_pedido(uuid, text) to authenticated;
grant execute on function rejeitar_pedido(uuid, text) to authenticated;
grant execute on function aprovar_pedido(uuid, jsonb, text) to authenticated;
grant execute on function despachar_pedido(uuid) to authenticated;
grant execute on function confirmar_entrega_remetente(uuid) to authenticated;
grant execute on function confirmar_recebimento_destinatario(uuid, jsonb) to authenticated;
