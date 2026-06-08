# Zoonoses — Controle de Estoque em Tempo Real (Supabase)

**Data:** 2026-06-07
**Autor:** Leonardo Cavalcanti (com Claude)
**Status:** Aprovado para planejamento

## Problema

O sistema de controle de estoque do centro de zoonoses está dividido em dois
repositórios que **não conversam**:

- `zoonoses-inventory-api` — API REST Express + Sequelize + Postgres, com domínio
  rico (produtos, categorias, fornecedores, setores, entradas/saídas, usuários
  com auth e papéis). É bem-feita, mas não está conectada a nenhum frontend ao vivo.
- `zoonoses-inventory-dashboard` — dashboard React + Vite + shadcn/ui que guarda
  tudo em `localStorage`, num único navegador, com um modelo simplificado e
  incompatível (Sector → Product → ActionHistory, com empréstimo/devolução).

Resultado: hoje é uma maquete bonita, **não um controle de estoque real**. Sem
persistência compartilhada, sem multiusuário, sem tempo real, sem validade/lotes.

## Objetivo

Transformar o dashboard num **controle de estoque real, multiusuário e em tempo
real**, hospedado e demonstrável ao vivo — útil de verdade para um centro de
zoonoses (vacinas, medicamentos, EPI, material de campo), e forte como peça de
portfólio acadêmico/profissional.

## Decisões (aprovadas)

| Decisão | Escolha |
|---|---|
| Arquitetura de tempo real | **Supabase** (Postgres + Realtime + Auth + RLS) |
| Profundidade do domínio | **Completa** (categorias, fornecedores, setores, lotes/validade, movimentações) |
| Autenticação | **Login + conta demo**; ações atribuídas ao responsável; RLS |
| Deploy | **GitHub Pages** (SPA) |
| Projeto Supabase | **Org/conta pessoal** (ref `vkjmewxojzhxillkjfft`), separada da empresa |
| Express API | Mantida como repo de showcase; não excluída |

## Arquitetura

```
┌────────────────────────┐         ┌──────────────────────────────────┐
│  Dashboard (GitHub      │  HTTPS  │  Supabase (projeto pessoal)       │
│  Pages, React+Vite+TS)  │◄───────►│  • Postgres (schema public)       │
│  • shadcn/ui            │  WSS    │  • Auth (email/senha)             │
│  • TanStack Query       │◄───────►│  • Realtime (postgres_changes)    │
│  • supabase-js          │         │  • RLS por papel                  │
└────────────────────────┘         └──────────────────────────────────┘
```

- **Sem servidor próprio.** O `supabase-js` fala direto com o Postgres via PostgREST
  e Realtime; o RLS é a fronteira de segurança.
- **TanStack Query** cuida de cache/fetch; **Realtime** emite eventos de mudança que
  invalidam/atualizam o cache, refletindo alterações ao vivo em todos os clientes.
- A **anon key** é pública por design (vai no bundle); o que protege os dados é o RLS.

## Modelo de dados (schema `public`)

```
profiles(id PK ↔ auth.users, nome, papel: 'admin'|'operador', created_at)
setores(id PK, nome UNIQUE, created_at)
categorias(id PK, nome UNIQUE, created_at)
fornecedores(id PK, nome, contato, created_at)
produtos(id PK, nome, categoria_id FK, fornecedor_id FK, setor_id FK,
         unidade, estoque_minimo INT DEFAULT 0, ativo BOOL DEFAULT true, created_at)
lotes(id PK, produto_id FK, codigo, validade DATE, quantidade INT DEFAULT 0,
      created_at)               -- quantidade mantida por trigger
movimentacoes(id PK, produto_id FK, lote_id FK NULL, tipo: 'entrada'|'saida'|'ajuste',
              quantidade INT, motivo TEXT, responsavel_id FK→profiles, created_at)
```

**Regras de integridade (no banco, via trigger/constraint):**
- Inserir `movimentacao` ajusta `lotes.quantidade` (entrada: `+`, saída: `−`, ajuste: define/corrige).
- Saída que deixaria o lote negativo é **rejeitada** (raise exception) — verdade no banco, não só na UI.
- `quantidade >= 0` como CHECK em `lotes`.

**Leitura derivada:**
- View `vw_estoque_produto`: soma de `lotes.quantidade` por produto + `estoque_minimo` →
  flag `estoque_baixo`.
- Validade: lotes com `validade <= hoje+30d` e `quantidade > 0` → "vencendo".

## Segurança (RLS)

- Todas as tabelas com RLS habilitado.
- **SELECT:** qualquer usuário autenticado lê tudo (é um sistema interno colaborativo).
- **INSERT/UPDATE/DELETE:**
  - `admin`: tudo, inclusive cadastros base e gestão de profiles.
  - `operador`: registra `movimentacoes`, cria/edita `produtos` e `lotes`; **não** apaga
    cadastros base (setores/categorias/fornecedores) nem gere profiles.
- **Conta demo** = `operador`: pode demonstrar o fluxo principal (registrar entrada/saída,
  ver tempo real) sem conseguir destruir a base de demonstração.
- `responsavel_id` em `movimentacoes` default = `auth.uid()`; trigger garante atribuição.

## Funcionalidades

1. **Auth:** login (email/senha), logout, sessão persistente; conta demo pré-criada.
2. **Visão geral:** cards (total de produtos, itens em estoque baixo, lotes vencendo ≤30d,
   movimentações hoje) + gráficos recharts (movimentações por dia; estoque por setor).
3. **Produtos:** CRUD com categoria/fornecedor/setor/unidade/estoque mínimo; busca e filtro.
4. **Lotes:** por produto, com código e validade; quantidade vem das movimentações.
5. **Movimentações:** registrar entrada/saída/ajuste — operação central, atribuída ao
   responsável logado, com motivo.
6. **Auditoria:** feed cronológico de movimentações, atualizado em tempo real.
7. **Cadastros:** setores, categorias, fornecedores.
8. **Alertas:** badges/realce para estoque baixo e validade próxima; toast ao vivo quando
   outro usuário registra uma movimentação.
9. **Tempo real (destaque):** mudança registrada num cliente aparece imediatamente nos
   demais (Realtime `postgres_changes` → invalidação/patch do cache TanStack Query).

## Visual

Visual **institucional, limpo e confiável** (ferramenta de saúde pública): layout com
sidebar + topbar, paleta calma neutra (slate) com um único acento de saúde (teal/verde),
tipografia legível e profissional (evitar fontes "AI slop"), densidade adequada à
informação, **estados vazios / skeleton / erro** bem tratados, suporte a dark + light.
Distinto da estética limão do portfólio — é outro produto, com outra missão.

## Deploy

- **GitHub Pages** via GitHub Actions (workflow de build + deploy do `dist/`).
- SPA com `HashRouter` (evita 404 em refresh no Pages).
- Renomear o repo `controle-estoque-zoonoses-frontend` → `zoonoses-inventory-dashboard`
  para a URL do demo ficar limpa; ajustar `base` do Vite ao novo nome.
- Variáveis de build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (injetadas via
  secrets do repositório no workflow).

## Aplicação do schema no Supabase

- Migrações versionadas em `supabase/migrations/*.sql` (Supabase CLI).
- Seed em `supabase/seed.sql` (dados realistas + base para a conta demo).
- Aplicação: `supabase login` (interativo, feito pelo usuário) → `supabase link
  --project-ref vkjmewxojzhxillkjfft` → `supabase db push` → seed.
- A conta demo (auth user) é criada via Admin API/SQL no seed e marcada como `operador`.

## Seed / dados de demonstração

- Setores: ex. Vigilância Ambiental, Vacinação, Almoxarifado, Controle de Vetores.
- Categorias: Vacinas, Medicamentos, EPI, Material de Campo, Saneantes.
- Fornecedores fictícios; produtos com lotes e validades variadas (alguns vencendo,
  alguns em estoque baixo, para os alertas aparecerem); movimentações históricas.
- Conta demo: e-mail/senha de demonstração, papel `operador`.

## Testes / Verificação

- `npm run build` e `npm run lint` limpos.
- Verificação manual via Playwright no demo ao vivo: abrir duas abas autenticadas,
  registrar uma saída numa, confirmar atualização **em tempo real** na outra; conferir
  alertas de estoque baixo e validade; conferir bloqueio de saída além do disponível.
- Testes de unidade leves na camada de dados (mapeadores/validações), onde fizer sentido.

## Fora de escopo (deste spec)

- **EloBelle** — tratado depois, separadamente.
- Migração dos dados de `localStorage` — começa limpo com seed.
- Reescrever/relinkar a Express API ao novo frontend — ela permanece como showcase.

## Fases de implementação (para o plano)

1. **Schema + RLS + triggers + seed** (migrações SQL no repo).
2. **Supabase client + Auth** (login, sessão, profile, guarda de rotas).
3. **Camada de dados + Realtime** (substituir `inventoryService` localStorage por queries
   Supabase + TanStack Query; subscriptions de tempo real).
4. **Páginas/features** (visão geral, produtos, lotes, movimentações, auditoria, cadastros).
5. **Polish visual + estados** (skeleton/empty/erro, alertas/toasts, dark/light).
6. **Deploy + verificação real-time + README** (rename repo, Pages, secrets, validação).
