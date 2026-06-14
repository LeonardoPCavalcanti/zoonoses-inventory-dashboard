# Elevação Zoonoses — Design (3 frentes)

Data: 2026-06-14
Escopo aprovado pelo usuário: **tudo** (dashboard + api + system).

## Contexto e veredito de arquitetura

O projeto Zoonoses são **três repositórios GitHub independentes**, em duas gerações.
Não há comunicação em runtime entre eles — e isso está correto (não é um sistema
de três peças integradas):

| Repo | Geração | O que é | Fala com |
|---|---|---|---|
| `zoonoses-inventory-dashboard` | Gen 2 (público, no ar) | React + Vite + Supabase | Só Supabase (zero acoplamento à api Express — confirmado por grep) |
| `zoonoses-inventory-api` | Gen 1 (referência) | Express 5 + Sequelize + Postgres próprio + JWT | Só o Postgres dele (`DATABASE_URL`) |
| `controle-estoque-zoonoses` (pasta `system`) | Gen 1 (índice) | README + docker-compose | Orquestra front+back+db da Gen 1 |

Problemas encontrados:
1. O `docker-compose.yml` do `system` referencia pastas (`controle-estoque-zoonoses-api/`,
   `controle-estoque-zoonoses-frontend/`) que **não existem** e não há submódulos →
   `docker compose up` não sobe. É documental/quebrado.
2. A `api` Express tem `cors`/`bcrypt`/`jwt`, mas **falta** `helmet`, `express-rate-limit`
   e validação de input; `app.use(cors())` é totalmente aberto.
3. No dashboard, o `Login.tsx` recebeu a elevação v2 (split-panel atmosférico), mas
   as demais páginas de auth (`Cadastrar`, `EsqueciSenha`, `RedefinirSenha`,
   `AguardandoAprovacao`, `AuthCallback`) são cards centrados simples — desnivelados.

Decisão sobre necessidade: **manter os três repos** (contam a narrativa "clássico →
realtime", valiosa para portfólio), mas tornar a Gen 1 honesta e executável.

---

## Frente A — Dashboard: nivelamento visual

Princípio: extrair o split-panel atmosférico do `Login.tsx` para um componente
compartilhado e reutilizá-lo, em vez de duplicar markup por página.

- **Criar `src/components/auth/AuthLayout.tsx`**: encapsula o `<aside>` da marca
  (logo Zoonoses, headline, lista de features com ícones, gradientes radiais,
  rodapé) + um `<main>` com slot (`children`) para o conteúdo do formulário.
  Props para variar headline/subtexto quando fizer sentido; default = o do Login.
- **Refatorar `Login.tsx`** para consumir `AuthLayout` (o painel sai de inline).
- **Embrulhar em `AuthLayout`**: `Cadastrar`, `EsqueciSenha`, `RedefinirSenha`,
  `AguardandoAprovacao`, `AuthCallback`. Mantêm sua lógica; ganham o shell premium.
- **Polir páginas in-app** (`Conta`, `UsuariosAdmin`) ao padrão v2: cabeçalho de
  página com `font-display`, espaçamento/cards consistentes, estados (loading/empty/
  error) já existentes reaproveitados. Não recebem split-panel (vivem no app shell).

Interface/isolamento: `AuthLayout` tem um único propósito (moldura de auth), API
clara (`children` + props opcionais de copy), e nenhuma dependência de dados.

Verificação: `tsc` + `lint` + `build` limpos; walkthrough Playwright das rotas de
auth confirmando o split-panel e 0 erros de console; `prefers-reduced-motion`
respeitado (reusar as classes `animate-fade-up` já existentes).

---

## Frente B — API Express: segurança

Endurecer sem mudar o contrato REST. Em `app.js` e arredores:

- **`helmet`**: headers de segurança padrão.
- **`express-rate-limit`**: limitador global brando + limitador estrito na rota de
  autenticação (`POST /api/usuarios/login`) contra brute-force.
- **CORS por allow-list**: trocar `cors()` aberto por origem(ns) via env
  (`CORS_ORIGIN`, CSV), com fallback seguro em dev.
- **Validação de input**: `express-validator` nas rotas de escrita
  (produtos/usuários/entradas/saídas) — rejeitar payloads malformados com 400.
- **Fail-fast de segredo**: abortar o boot se `JWT_SECRET` ausente (sem fallback).
- **Error handler centralizado**: middleware final que não vaza stack em produção.
- **bcrypt**: garantir rounds ≥ 10.

Verificação: suíte Jest/Supertest existente continua verde; adicionar testes para
rate-limit (429) e validação (400) onde for direto. Sem segredos reais no repo.

---

## Frente C — system + api: compose que roda de verdade

Objetivo: um `docker compose up` honesto que sobe **só o que existe** (api + db).

- **No repo `api`**: adicionar `docker-compose.yml` auto-contido:
  - serviço `db` (postgres:15, volume nomeado, env de dev);
  - serviço `backend` (build do Dockerfile existente, `DATABASE_URL` apontando p/ `db`,
    `depends_on: db`, healthcheck simples);
  - **seed**: script idempotente (usuário demo com hash bcrypt + alguns produtos/
    setores/categorias) rodando no boot quando o banco está vazio. O schema se cria
    via `sequelize.sync({ alter: true })` já existente — sem step de migração extra.
  - Atualizar o README da api com o `docker compose up` standalone.
- **No repo `system`**: adicionar a `api` como **git submodule**; reescrever o
  `docker-compose.yml` para buildar a partir do submódulo (db + backend), removendo
  a referência ao frontend Gen 1 inexistente; atualizar o README contando a história
  real (índice da Gen 1, backend+db executável; Gen 2 ao vivo é o dashboard).

Verificação: `docker compose config` válido nos dois repos; se o ambiente permitir,
`docker compose up` sobe api+db e o seed popula (checagem manual de `GET /` e uma
rota). Caso o Docker não esteja disponível na sessão, validar por `config` + revisão.

---

## Sequência e integração

Implementar A → B → C. Cada repo recebe commits próprios em `main` (fluxo já usado
neste projeto pessoal). Sem alterar `database-prod`/api-shopee (fora de alcance).

## Fora de escopo (YAGNI)

- Integrar os três repos em runtime (são gerações distintas, por design).
- Ressuscitar o frontend Gen 1 (foi descartado; o Gen 2 o substitui).
- E-mails automáticos/SMTP e Auth Hook de INACTIVE (dependem de config do Dashboard
  do usuário — já documentados em `docs/GESTAO-DE-USUARIOS.md`).
