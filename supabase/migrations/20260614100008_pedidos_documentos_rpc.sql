-- Registra o documento ORIGINAL anexado pelo núcleo (storage já recebeu o arquivo).
create or replace function registrar_documento(
  p_pedido_id uuid, p_storage_path text, p_filename text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); ped pedidos%rowtype; doc_id uuid;
begin
  if actor is null then raise exception 'Não autenticado'; end if;
  select * into ped from pedidos where id = p_pedido_id;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if ped.nucleo_id is distinct from my_nucleo() and not can_approve_orders() then
    raise exception 'Sem permissão para anexar documento a este pedido';
  end if;
  insert into pedido_documentos(pedido_id, tipo, storage_path, filename, enviado_por)
  values (p_pedido_id, 'ORIGINAL', p_storage_path, p_filename, actor)
  returning id into doc_id;
  insert into pedido_eventos(pedido_id, tipo, ator_id, dados)
  values (p_pedido_id, 'DOCUMENTO_ANEXADO', actor, jsonb_build_object('filename', p_filename));
  return doc_id;
end; $$;

-- Finaliza a aprovação APÓS o carimbo do PDF pela Edge Function (service_role).
-- Faz o mesmo que aprovar_pedido + grava o documento APROVADO assinado.
create or replace function finalizar_aprovacao(
  p_pedido_id uuid,
  p_analista uuid,
  p_itens_aprovados jsonb,
  p_comentario text,
  p_storage_path text,
  p_assinatura_png text,
  p_hash text
) returns void
language plpgsql security definer set search_path = public as $$
declare st pedido_status; item jsonb;
begin
  select status into st from pedidos where id = p_pedido_id;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if st <> 'AGUARDANDO_ANALISE' then raise exception 'Pedido não está aguardando análise'; end if;

  for item in select * from jsonb_array_elements(coalesce(p_itens_aprovados, '[]'::jsonb)) loop
    update pedido_itens set qtd_aprovada = (item->>'qtd')::int
      where id = (item->>'item_id')::uuid and pedido_id = p_pedido_id;
  end loop;
  update pedido_itens set qtd_aprovada = qtd_solicitada
    where pedido_id = p_pedido_id and qtd_aprovada is null;

  update pedidos set status = 'APROVADO', analista_id = p_analista,
    analisado_em = now(), devolvido_em = now(), updated_at = now()
    where id = p_pedido_id;

  insert into pedido_documentos(pedido_id, tipo, storage_path, filename, enviado_por, assinatura_png, hash_sha256)
  values (p_pedido_id, 'APROVADO', p_storage_path, 'aval-assinado.pdf', p_analista, p_assinatura_png, p_hash);

  insert into pedido_eventos(pedido_id, tipo, ator_id, dados)
  values (p_pedido_id, 'APROVADO', p_analista,
          jsonb_build_object('comentario', p_comentario, 'hash', p_hash));
end; $$;

-- Postura de segurança igual à Fase 1: nada de anon/public.
revoke execute on function registrar_documento(uuid, text, text) from public, anon;
revoke execute on function finalizar_aprovacao(uuid, uuid, jsonb, text, text, text, text) from public, anon, authenticated;
grant execute on function finalizar_aprovacao(uuid, uuid, jsonb, text, text, text, text) to service_role;
