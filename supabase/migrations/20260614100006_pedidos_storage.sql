-- Bucket privado para documentos de pedidos. Download sempre por signed URL.
insert into storage.buckets (id, name, public)
values ('pedidos-documentos', 'pedidos-documentos', false)
on conflict (id) do nothing;

-- Convenção de caminho: pedidos/{pedido_id}/(original|aprovado)/{arquivo}
-- A visibilidade espelha o RLS de `pedidos`: a subconsulta abaixo já é
-- filtrada pelo RLS da tabela pedidos para o usuário autenticado.

-- SELECT: pode ler o objeto se enxerga o pedido correspondente.
create policy "pedidos_docs_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'pedidos-documentos'
  and exists (
    select 1 from public.pedidos p
    where p.id = nullif(split_part(name, '/', 2), '')::uuid
  )
);

-- INSERT: o núcleo dono (ou um analista) anexa o documento ORIGINAL.
-- O documento APROVADO é gravado pela Edge Function via service_role (ignora RLS).
create policy "pedidos_docs_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'pedidos-documentos'
  and exists (
    select 1 from public.pedidos p
    where p.id = nullif(split_part(name, '/', 2), '')::uuid
      and (p.nucleo_id = public.my_nucleo() or public.can_approve_orders())
  )
);
