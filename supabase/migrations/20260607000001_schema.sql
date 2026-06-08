-- Schema base do controle de estoque de zoonoses.
create type papel_usuario as enum ('admin', 'operador');
create type tipo_movimentacao as enum ('entrada', 'saida', 'ajuste');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  papel papel_usuario not null default 'operador',
  created_at timestamptz not null default now()
);

create table setores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);

create table categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);

create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  contato text,
  created_at timestamptz not null default now()
);

create table produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria_id uuid references categorias(id) on delete set null,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  setor_id uuid references setores(id) on delete set null,
  unidade text not null default 'un',
  estoque_minimo int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table lotes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id) on delete cascade,
  codigo text,
  validade date,
  quantidade int not null default 0 check (quantidade >= 0),
  created_at timestamptz not null default now()
);

create table movimentacoes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id) on delete cascade,
  lote_id uuid references lotes(id) on delete set null,
  tipo tipo_movimentacao not null,
  quantidade int not null check (quantidade > 0),
  motivo text,
  responsavel_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_produtos_setor on produtos(setor_id);
create index idx_lotes_produto on lotes(produto_id);
create index idx_lotes_validade on lotes(validade);
create index idx_mov_produto on movimentacoes(produto_id);
create index idx_mov_created on movimentacoes(created_at desc);
