-- Seed de demonstração do controle de estoque de zoonoses.
-- Idempotente: limpa o domínio (preserva profiles/auth) e recria.
truncate movimentacoes, lotes, produtos, fornecedores, categorias, setores
  restart identity cascade;

-- Cadastros base
insert into setores (nome) values
  ('Vigilância Ambiental'), ('Vacinação'), ('Almoxarifado'), ('Controle de Vetores');

insert into categorias (nome) values
  ('Vacinas'), ('Medicamentos'), ('EPI'), ('Material de Campo'), ('Saneantes');

insert into fornecedores (nome, contato) values
  ('BioFarma Distribuidora', 'contato@biofarma.example'),
  ('VetSupply Brasil', 'vendas@vetsupply.example'),
  ('Saúde Pública Insumos', 'sp@insumos.example');

-- Produtos
insert into produtos (nome, categoria_id, fornecedor_id, setor_id, unidade, estoque_minimo)
values
  ('Vacina Antirrábica Canina',
     (select id from categorias where nome='Vacinas'),
     (select id from fornecedores where nome='BioFarma Distribuidora'),
     (select id from setores where nome='Vacinação'), 'dose', 50),
  ('Soro Antiofídico Polivalente',
     (select id from categorias where nome='Medicamentos'),
     (select id from fornecedores where nome='VetSupply Brasil'),
     (select id from setores where nome='Almoxarifado'), 'ampola', 10),
  ('Luva de Procedimento',
     (select id from categorias where nome='EPI'),
     (select id from fornecedores where nome='Saúde Pública Insumos'),
     (select id from setores where nome='Almoxarifado'), 'caixa', 20),
  ('Armadilha para Roedores',
     (select id from categorias where nome='Material de Campo'),
     (select id from fornecedores where nome='VetSupply Brasil'),
     (select id from setores where nome='Controle de Vetores'), 'un', 15),
  ('Larvicida Biológico (BTI)',
     (select id from categorias where nome='Saneantes'),
     (select id from fornecedores where nome='BioFarma Distribuidora'),
     (select id from setores where nome='Controle de Vetores'), 'litro', 30),
  ('Vacina V10 Canina',
     (select id from categorias where nome='Vacinas'),
     (select id from fornecedores where nome='BioFarma Distribuidora'),
     (select id from setores where nome='Vacinação'), 'dose', 40);

-- Lotes (validades variadas — algumas vencendo em <30d)
insert into lotes (produto_id, codigo, validade) values
  ((select id from produtos where nome='Vacina Antirrábica Canina'), 'ANTIR-2026-01', current_date + 20),
  ((select id from produtos where nome='Soro Antiofídico Polivalente'), 'SORO-A12', current_date + 365),
  ((select id from produtos where nome='Luva de Procedimento'), 'LUVA-X9', current_date + 720),
  ((select id from produtos where nome='Armadilha para Roedores'), 'ARM-09', null),
  ((select id from produtos where nome='Larvicida Biológico (BTI)'), 'BTI-2026', current_date + 90),
  ((select id from produtos where nome='Vacina V10 Canina'), 'V10-77', current_date + 25);

-- Entradas iniciais (o trigger aplica ao saldo dos lotes)
insert into movimentacoes (produto_id, lote_id, tipo, quantidade, motivo, created_at) values
  ((select id from produtos where nome='Vacina Antirrábica Canina'),
     (select id from lotes where codigo='ANTIR-2026-01'), 'entrada', 200, 'Recebimento BioFarma', now() - interval '6 days'),
  ((select id from produtos where nome='Soro Antiofídico Polivalente'),
     (select id from lotes where codigo='SORO-A12'), 'entrada', 8, 'Reposição', now() - interval '5 days'),
  ((select id from produtos where nome='Luva de Procedimento'),
     (select id from lotes where codigo='LUVA-X9'), 'entrada', 60, 'Recebimento EPI', now() - interval '5 days'),
  ((select id from produtos where nome='Armadilha para Roedores'),
     (select id from lotes where codigo='ARM-09'), 'entrada', 10, 'Compra', now() - interval '4 days'),
  ((select id from produtos where nome='Larvicida Biológico (BTI)'),
     (select id from lotes where codigo='BTI-2026'), 'entrada', 45, 'Recebimento', now() - interval '3 days'),
  ((select id from produtos where nome='Vacina V10 Canina'),
     (select id from lotes where codigo='V10-77'), 'entrada', 120, 'Recebimento BioFarma', now() - interval '3 days');

-- Saídas (campanhas / consumo) — geram histórico e estoque baixo onde aplicável
insert into movimentacoes (produto_id, lote_id, tipo, quantidade, motivo, created_at) values
  ((select id from produtos where nome='Vacina Antirrábica Canina'),
     (select id from lotes where codigo='ANTIR-2026-01'), 'saida', 30, 'Campanha de vacinação', now() - interval '2 days'),
  ((select id from produtos where nome='Luva de Procedimento'),
     (select id from lotes where codigo='LUVA-X9'), 'saida', 15, 'Uso em campo', now() - interval '1 days'),
  ((select id from produtos where nome='Larvicida Biológico (BTI)'),
     (select id from lotes where codigo='BTI-2026'), 'saida', 10, 'Aplicação em focos', now() - interval '6 hours');
