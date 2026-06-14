-- Publica as tabelas de pedidos no Realtime e semeia núcleos demo.
alter publication supabase_realtime add table pedidos;
alter publication supabase_realtime add table pedido_eventos;

insert into nucleos (nome, codigo) values
  ('Núcleo Centro', 'NUC-CENTRO'),
  ('Núcleo Norte', 'NUC-NORTE'),
  ('Núcleo Sul', 'NUC-SUL')
on conflict (codigo) do nothing;
