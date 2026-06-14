-- Módulo de pedidos: núcleos, pedidos e o workflow documental (Fase 1, sem docs).

-- 1. Enums.
create type pedido_status as enum (
  'AGUARDANDO_ANALISE', 'EM_REVISAO', 'APROVADO', 'REJEITADO',
  'ENVIADO', 'CONCLUIDO', 'CONCLUIDO_PARCIAL'
);
create type documento_tipo as enum ('ORIGINAL', 'APROVADO');
create type pedido_evento_tipo as enum (
  'CRIADO', 'CRITICADO', 'RESUBMETIDO', 'APROVADO', 'REJEITADO',
  'ENVIADO', 'ENTREGA_CONFIRMADA', 'CONCLUIDO'
);

-- 2. Núcleos (unidades solicitantes) e vínculo do supervisor ao núcleo.
create table nucleos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text not null unique,
  created_at timestamptz not null default now()
);

alter table profiles add column nucleo_id uuid references nucleos(id) on delete set null;

-- 3. Sequência anual para o código PED-AAAA-NNNN.
create table pedido_sequencia (
  ano int primary key,
  ultimo int not null default 0
);

-- 4. Pedidos.
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  status pedido_status not null default 'AGUARDANDO_ANALISE',
  justificativa text not null,
  nucleo_id uuid not null references nucleos(id) on delete restrict,
  solicitante_id uuid references profiles(id) on delete set null,
  analista_id uuid references profiles(id) on delete set null,
  analisado_em timestamptz,
  devolvido_em timestamptz,
  enviado_por uuid references profiles(id) on delete set null,
  enviado_em timestamptz,
  entrega_remetente_por uuid references profiles(id) on delete set null,
  entrega_remetente_em timestamptz,
  entrega_destinatario_por uuid references profiles(id) on delete set null,
  entrega_destinatario_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  produto_id uuid not null references produtos(id) on delete restrict,
  qtd_solicitada int not null check (qtd_solicitada > 0),
  qtd_aprovada int check (qtd_aprovada >= 0),
  qtd_recebida int check (qtd_recebida >= 0)
);

create table pedido_criticas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  autor_id uuid references profiles(id) on delete set null,
  motivo text not null,
  created_at timestamptz not null default now()
);

create table pedido_eventos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  tipo pedido_evento_tipo not null,
  ator_id uuid references profiles(id) on delete set null,
  dados jsonb,
  created_at timestamptz not null default now()
);

-- 5. Documentos: tabela criada já aqui (preenchida só na Fase 2).
create table pedido_documentos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  tipo documento_tipo not null,
  storage_path text not null,
  filename text not null,
  enviado_por uuid references profiles(id) on delete set null,
  enviado_em timestamptz not null default now(),
  assinatura_png text,
  hash_sha256 text
);

create index idx_pedidos_nucleo on pedidos(nucleo_id);
create index idx_pedidos_status on pedidos(status);
create index idx_pedidos_created on pedidos(created_at desc);
create index idx_pedido_itens_pedido on pedido_itens(pedido_id);
create index idx_pedido_eventos_pedido on pedido_eventos(pedido_id, created_at);
create index idx_pedido_criticas_pedido on pedido_criticas(pedido_id, created_at);
