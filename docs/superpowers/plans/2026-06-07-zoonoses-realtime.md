# Zoonoses Real-Time Inventory — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. Steps use `- [ ]` checkboxes.

**Goal:** Migrar o dashboard de `localStorage` para um controle de estoque real, multiusuário e em tempo real sobre Supabase, com login, domínio completo (produtos/lotes/movimentações) e deploy ao vivo no GitHub Pages.

**Architecture:** SPA React+Vite+TS+shadcn/ui falando direto com Supabase (Postgres + Auth + Realtime + RLS) via `supabase-js`. TanStack Query para cache; Realtime `postgres_changes` invalida o cache. Sem servidor próprio. Estoque é verdade no banco (trigger sobre `movimentacoes`).

**Tech Stack:** React 18, Vite, TypeScript, shadcn/ui, Tailwind, @tanstack/react-query, @supabase/supabase-js, recharts, sonner, react-router-dom (HashRouter), Supabase CLI.

---

## File Structure

```
supabase/
├── config.toml                      # gerado por `supabase init`
├── migrations/
│   ├── 0001_schema.sql              # tabelas, enums, índices
│   ├── 0002_triggers.sql            # estoque por trigger + guarda de saída negativa
│   ├── 0003_views.sql               # vw_estoque_produto
│   └── 0004_rls.sql                 # RLS + policies por papel
└── seed.sql                         # dados demo + perfis

src/
├── lib/
│   ├── supabase.ts                  # cliente supabase-js (env)
│   └── queryKeys.ts                 # chaves TanStack Query centralizadas
├── auth/
│   ├── AuthProvider.tsx             # sessão + profile + signIn/signOut
│   └── ProtectedRoute.tsx           # guarda de rota
├── data/
│   ├── types.ts                     # tipos do domínio (substitui types/inventory.ts)
│   ├── produtos.ts                  # queries/mutations de produtos
│   ├── lotes.ts
│   ├── movimentacoes.ts
│   ├── cadastros.ts                 # setores, categorias, fornecedores
│   └── dashboard.ts                 # agregações da visão geral
├── hooks/
│   └── useRealtime.ts               # subscription genérica postgres_changes -> invalidate
├── pages/
│   ├── Login.tsx
│   ├── Overview.tsx                 # visão geral (cards + charts)
│   ├── Produtos.tsx
│   ├── Movimentacoes.tsx
│   ├── Auditoria.tsx
│   └── Cadastros.tsx
├── components/
│   ├── layout/AppShell.tsx          # sidebar + topbar
│   ├── produtos/ProdutoForm.tsx, ProdutoTable.tsx
│   ├── movimentacoes/MovimentacaoDialog.tsx
│   └── shared/{StatCard,EmptyState,ErrorState,TableSkeleton,AlertBadge}.tsx
└── App.tsx                          # rotas (HashRouter) + providers
```

Componentes shadcn em `src/components/ui/*` permanecem. `src/services/inventoryService.ts`, `src/types/inventory.ts`, `src/components/{ActionHistory,ProductManager,SectorManager}.tsx`, `src/pages/Index.tsx` são substituídos/removidos.

---

## Phase 1 — Schema, triggers, RLS, seed

### Task 1.1: Inicializar Supabase no repo

**Files:** Create `supabase/config.toml` (via CLI)

- [ ] **Step 1:** Na raiz do repo: `supabase init` (gera `supabase/`). Se perguntar sobre VS Code/Deno, responder não.
- [ ] **Step 2:** Commit: `git add supabase/config.toml .gitignore && git commit -m "chore(supabase): init"`

### Task 1.2: Migração de schema

**Files:** Create `supabase/migrations/0001_schema.sql`

- [ ] **Step 1:** Escrever o SQL:

```sql
-- 0001_schema.sql
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
```

- [ ] **Step 2:** Commit: `git add supabase/migrations/0001_schema.sql && git commit -m "feat(db): schema base do estoque"`

### Task 1.3: Triggers de estoque

**Files:** Create `supabase/migrations/0002_triggers.sql`

- [ ] **Step 1:** Escrever o SQL (mantém `lotes.quantidade` e atribui responsável):

```sql
-- 0002_triggers.sql
-- Atribui o responsável (usuário logado) por padrão.
create or replace function set_responsavel() returns trigger
language plpgsql security definer as $$
begin
  if new.responsavel_id is null then new.responsavel_id := auth.uid(); end if;
  return new;
end; $$;

create trigger trg_mov_responsavel before insert on movimentacoes
for each row execute function set_responsavel();

-- Aplica a movimentação ao saldo do lote (verdade no banco).
create or replace function aplicar_movimentacao() returns trigger
language plpgsql as $$
declare saldo int;
begin
  if new.lote_id is null then
    raise exception 'Movimentação exige um lote';
  end if;
  select quantidade into saldo from lotes where id = new.lote_id for update;
  if new.tipo = 'entrada' then
    update lotes set quantidade = quantidade + new.quantidade where id = new.lote_id;
  elsif new.tipo = 'saida' then
    if saldo < new.quantidade then
      raise exception 'Estoque insuficiente: saldo % < saída %', saldo, new.quantidade;
    end if;
    update lotes set quantidade = quantidade - new.quantidade where id = new.lote_id;
  elsif new.tipo = 'ajuste' then
    update lotes set quantidade = new.quantidade where id = new.lote_id;
  end if;
  return new;
end; $$;

create trigger trg_mov_aplicar after insert on movimentacoes
for each row execute function aplicar_movimentacao();

-- Cria profile automaticamente para todo novo usuário do Auth.
create or replace function handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into public.profiles (id, nome, papel)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)), 'operador')
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger trg_auth_new_user after insert on auth.users
for each row execute function handle_new_user();
```

- [ ] **Step 2:** Commit: `git add supabase/migrations/0002_triggers.sql && git commit -m "feat(db): triggers de estoque, responsavel e profile"`

### Task 1.4: View de estoque

**Files:** Create `supabase/migrations/0003_views.sql`

- [ ] **Step 1:**

```sql
-- 0003_views.sql
create or replace view vw_estoque_produto as
select
  p.id as produto_id, p.nome, p.unidade, p.estoque_minimo,
  p.setor_id, p.categoria_id, p.ativo,
  coalesce(sum(l.quantidade), 0)::int as estoque_total,
  (coalesce(sum(l.quantidade), 0) <= p.estoque_minimo) as estoque_baixo,
  min(l.validade) filter (where l.quantidade > 0) as proxima_validade
from produtos p
left join lotes l on l.produto_id = p.id
group by p.id;
```

- [ ] **Step 2:** Commit: `git add supabase/migrations/0003_views.sql && git commit -m "feat(db): view de estoque por produto"`

### Task 1.5: RLS e policies

**Files:** Create `supabase/migrations/0004_rls.sql`

- [ ] **Step 1:**

```sql
-- 0004_rls.sql
alter table profiles enable row level security;
alter table setores enable row level security;
alter table categorias enable row level security;
alter table fornecedores enable row level security;
alter table produtos enable row level security;
alter table lotes enable row level security;
alter table movimentacoes enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer as $$
  select exists(select 1 from profiles where id = auth.uid() and papel = 'admin');
$$;

-- Leitura: qualquer autenticado.
create policy sel_auth on profiles      for select to authenticated using (true);
create policy sel_auth on setores       for select to authenticated using (true);
create policy sel_auth on categorias    for select to authenticated using (true);
create policy sel_auth on fornecedores  for select to authenticated using (true);
create policy sel_auth on produtos      for select to authenticated using (true);
create policy sel_auth on lotes         for select to authenticated using (true);
create policy sel_auth on movimentacoes for select to authenticated using (true);

-- Operador+admin: produtos, lotes, movimentações.
create policy wr_prod on produtos for all to authenticated using (true) with check (true);
create policy wr_lote on lotes for all to authenticated using (true) with check (true);
create policy ins_mov on movimentacoes for insert to authenticated with check (true);

-- Cadastros base: somente admin escreve.
create policy wr_setor   on setores      for all to authenticated using (is_admin()) with check (is_admin());
create policy wr_categ   on categorias   for all to authenticated using (is_admin()) with check (is_admin());
create policy wr_forn    on fornecedores for all to authenticated using (is_admin()) with check (is_admin());

-- Profiles: cada um vê/edita o seu; admin gere todos.
create policy own_profile on profiles for update to authenticated using (id = auth.uid() or is_admin());
```

- [ ] **Step 2:** Commit: `git add supabase/migrations/0004_rls.sql && git commit -m "feat(db): RLS por papel"`

### Task 1.6: Seed

**Files:** Create `supabase/seed.sql`

- [ ] **Step 1:** Escrever seed com setores/categorias/fornecedores/produtos/lotes (com validades variadas p/ alertas) e movimentações iniciais. (Conta demo é criada no Task 1.7 via Auth, depois marcada admin/operador aqui por update.)
- [ ] **Step 2:** Commit.

### Task 1.7: Aplicar no Supabase (usuário + agente)

- [ ] **Step 1 (usuário):** `! supabase login` (abre o browser, autentica a CLI).
- [ ] **Step 2 (usuário):** `! supabase link --project-ref vkjmewxojzhxillkjfft` (pede a senha do DB).
- [ ] **Step 3 (agente):** `supabase db push` aplica as migrações.
- [ ] **Step 4 (agente):** aplica `seed.sql`; cria conta demo (`supabase` SQL/Admin) e a marca `operador`; cria um `admin` para o usuário.
- [ ] **Step 5 (agente):** Habilita Realtime nas tabelas `movimentacoes`, `lotes`, `produtos` (publication `supabase_realtime`).
- [ ] **Step 6:** Verificar via SQL: inserir movimentação de saída além do saldo deve falhar; `vw_estoque_produto` retorna flags corretas.

---

## Phase 2 — Cliente Supabase + Auth

### Task 2.1: Dependências e cliente

**Files:** Create `src/lib/supabase.ts`, `.env.example`; Modify `package.json`

- [ ] **Step 1:** `npm i @supabase/supabase-js`
- [ ] **Step 2:** `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  // Falha cedo e clara em build/preview sem env.
  console.warn('Supabase env ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
});
```

- [ ] **Step 3:** `.env.example` com `VITE_SUPABASE_URL=` e `VITE_SUPABASE_ANON_KEY=`. Garantir `.env` no `.gitignore`.
- [ ] **Step 4:** Criar `.env` local com a URL `https://vkjmewxojzhxillkjfft.supabase.co` e a anon key (obtida via `supabase projects api-keys --project-ref vkjmewxojzhxillkjfft`).
- [ ] **Step 5:** Commit (sem `.env`).

### Task 2.2: AuthProvider + ProtectedRoute

**Files:** Create `src/auth/AuthProvider.tsx`, `src/auth/ProtectedRoute.tsx`

- [ ] **Step 1:** `AuthProvider` expõe `{ session, profile, loading, signIn, signOut }`; carrega sessão (`supabase.auth.getSession`), assina `onAuthStateChange`, busca `profiles` do usuário.
- [ ] **Step 2:** `ProtectedRoute` redireciona p/ `/login` se sem sessão; mostra skeleton enquanto `loading`.
- [ ] **Step 3:** Commit.

### Task 2.3: Página de Login

**Files:** Create `src/pages/Login.tsx`

- [ ] **Step 1:** Form (react-hook-form + zod) email/senha → `signIn`; botão "Entrar como demonstração" preenche as credenciais demo; erros via `sonner`.
- [ ] **Step 2:** Commit.

---

## Phase 3 — Camada de dados + Realtime

### Task 3.1: Tipos do domínio

**Files:** Create `src/data/types.ts`; Delete `src/types/inventory.ts`

- [ ] **Step 1:** Definir `Setor, Categoria, Fornecedor, Produto, Lote, Movimentacao, EstoqueProduto, Profile` espelhando o schema.
- [ ] **Step 2:** Commit.

### Task 3.2: Query keys + módulos de dados

**Files:** Create `src/lib/queryKeys.ts`, `src/data/{produtos,lotes,movimentacoes,cadastros,dashboard}.ts`

- [ ] **Step 1:** Funções async com `supabase.from(...)` (select com joins; insert/update/delete) retornando tipos do domínio; tratar `error` (lançar p/ TanStack Query).
- [ ] **Step 2:** Hooks `useQuery`/`useMutation` por entidade, invalidando as keys certas no sucesso; `toast` de sucesso/erro.
- [ ] **Step 3:** Commit.

### Task 3.3: Realtime genérico

**Files:** Create `src/hooks/useRealtime.ts`

- [ ] **Step 1:**

```ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/** Assina mudanças em `tables` e invalida as queryKeys correspondentes. */
export function useRealtime(tables: { table: string; keys: unknown[][] }[]) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel('realtime-estoque');
    for (const t of tables) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t.table }, () => {
        t.keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      });
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
}
```

- [ ] **Step 2:** Commit.

---

## Phase 4 — Páginas e features

### Task 4.1: App shell + rotas

**Files:** Create `src/components/layout/AppShell.tsx`; Modify `src/App.tsx`, `src/main.tsx`

- [ ] **Step 1:** `App.tsx` com `HashRouter`, `QueryClientProvider`, `AuthProvider`, `Toaster` (sonner) e rotas: `/login` pública; restante dentro de `ProtectedRoute` + `AppShell` (sidebar: Visão geral, Produtos, Movimentações, Auditoria, Cadastros; topbar com usuário + sair).
- [ ] **Step 2:** Commit.

### Task 4.2: Visão geral

**Files:** Create `src/pages/Overview.tsx`, `src/components/shared/StatCard.tsx`, `src/data/dashboard.ts`

- [ ] **Step 1:** Cards (total produtos, estoque baixo, vencendo ≤30d, movimentações hoje) a partir de `vw_estoque_produto`/agregações; 2 gráficos recharts (movimentações/dia; estoque/setor). `useRealtime` ativo.
- [ ] **Step 2:** Commit.

### Task 4.3: Produtos + Lotes

**Files:** Create `src/pages/Produtos.tsx`, `src/components/produtos/{ProdutoTable,ProdutoForm}.tsx`

- [ ] **Step 1:** Tabela com busca/filtro por setor, badge de estoque baixo/validade; dialog de criar/editar (categoria/fornecedor/setor/unidade/estoque mínimo); gestão de lotes do produto (código/validade); quantidade só muda por movimentação.
- [ ] **Step 2:** Commit.

### Task 4.4: Movimentações

**Files:** Create `src/pages/Movimentacoes.tsx`, `src/components/movimentacoes/MovimentacaoDialog.tsx`

- [ ] **Step 1:** Form: produto → lote → tipo (entrada/saída/ajuste) → quantidade → motivo. Erro do banco (estoque insuficiente) exibido via toast. Lista recente em tempo real.
- [ ] **Step 2:** Commit.

### Task 4.5: Auditoria + Cadastros

**Files:** Create `src/pages/Auditoria.tsx`, `src/pages/Cadastros.tsx`

- [ ] **Step 1:** Auditoria: feed cronológico de movimentações (produto, tipo, qtd, responsável, hora) em tempo real, com filtro por tipo/produto.
- [ ] **Step 2:** Cadastros: CRUD de setores/categorias/fornecedores (escrita só admin; operador vê desabilitado).
- [ ] **Step 3:** Commit.

---

## Phase 5 — Polish visual + estados

### Task 5.1: Tema institucional

**Files:** Modify `src/index.css`, `tailwind.config.ts`

- [ ] **Step 1:** Paleta slate + acento teal/verde (variáveis CSS shadcn light/dark); fonte profissional (ex.: "Plus Jakarta Sans" ou "Geist" via Google/Fontsource — não Inter/Roboto/Arial). Topbar com toggle dark/light (`next-themes`).
- [ ] **Step 2:** Commit.

### Task 5.2: Estados compartilhados

**Files:** Create `src/components/shared/{EmptyState,ErrorState,TableSkeleton,AlertBadge}.tsx`; aplicar nas páginas

- [ ] **Step 1:** Skeleton durante `isLoading`, EmptyState quando vazio, ErrorState em erro, AlertBadge p/ estoque baixo/validade. Toast (sonner) ao receber movimentação de outro usuário ("Fulano registrou saída de X").
- [ ] **Step 2:** Commit.

---

## Phase 6 — Deploy + verificação + README

### Task 6.1: Build base + workflow Pages

**Files:** Modify `vite.config.ts`; Create `.github/workflows/deploy.yml`

- [ ] **Step 1:** `base: '/zoonoses-inventory-dashboard/'` no Vite; `HashRouter` já cobre rotas.
- [ ] **Step 2:** Workflow: `npm ci → npm run build` com `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` vindos de `secrets`; deploy via `actions/deploy-pages`.
- [ ] **Step 3:** `npm run build` + `npm run lint` limpos localmente.
- [ ] **Step 4:** Commit.

### Task 6.2: Security review + tornar público + Pages

- [ ] **Step 1:** Verificar que nenhum segredo está commitado (`.env` ignorado; só anon key pública via secret no Actions). Confirmar RLS ativo em todas as tabelas.
- [ ] **Step 2:** Definir secrets do repo (`gh secret set VITE_SUPABASE_URL ...`, idem anon key).
- [ ] **Step 3:** Tornar repo público (`gh repo edit --visibility public`) e habilitar Pages (source=Actions). [Aprovado pelo usuário; anon key é pública por design.]
- [ ] **Step 4:** Push → aguardar workflow → verificar HTTP 200 no demo.

### Task 6.3: Verificação real-time (Playwright)

- [ ] **Step 1:** Abrir 2 abas autenticadas no demo; registrar uma saída numa; confirmar atualização imediata na outra (cards/auditoria) + toast.
- [ ] **Step 2:** Conferir: saída além do saldo é bloqueada com mensagem; alertas de estoque baixo/validade aparecem.

### Task 6.4: README + screenshot

**Files:** Modify `README.md`; Create `docs/preview.png`

- [ ] **Step 1:** Reescrever README: o que é, stack (Supabase realtime), como rodar local (com `.env`), link do demo + conta demo, e seção acadêmica "O que este projeto ensina" (tempo real com Postgres changes, RLS, estoque como verdade no banco via trigger). Screenshot real do demo.
- [ ] **Step 2:** Atualizar o README da `zoonoses-inventory-api` apontando o demo ao vivo. Commit/push.

---

## Self-Review

- **Cobertura do spec:** auth+demo (P2/T1.7), domínio completo (P1), movimentações/auditoria (P4.4/4.5), lotes/validade+alertas (P1,P4.3,P5.2), tempo real (P3.3,P4,P6.3), RLS (P1.5), visual institucional (P5), deploy Pages (P6), README acadêmico (P6.4), Express mantida (P6.4). ✔
- **Placeholders:** seed (T1.6) descreve conteúdo sem SQL completo — será escrito na execução com dados concretos; demais SQL/código estão completos.
- **Consistência de tipos:** `vw_estoque_produto` colunas usadas em P4.2; `useRealtime({table,keys})` assinatura usada em P4. Triggers exigem `lote_id` (movimentação sempre tem lote) — refletido no MovimentacaoDialog (P4.4).
