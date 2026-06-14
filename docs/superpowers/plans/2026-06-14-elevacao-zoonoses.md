# Elevação Zoonoses — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nivelar visualmente as páginas de auth do dashboard, endurecer a segurança da api Express, e tornar a Gen 1 executável via um `docker compose up` honesto.

**Architecture:** Três frentes independentes, uma por repositório. A (dashboard): extrair um `AuthLayout` compartilhado e aplicá-lo às páginas de auth + polir páginas in-app. B (api): adicionar helmet, rate-limit, CORS allow-list, validação de input e fail-fast de segredo, mantendo o contrato REST. C (system+api): compose auto-contido api+db com seed; system referencia a api por submódulo.

**Tech Stack:** React 18 + Vite + TS + Tailwind/shadcn (dashboard); Express 5 + Sequelize + Jest/Supertest (api); Docker Compose + Postgres 15 (infra).

Spec: `docs/superpowers/specs/2026-06-14-elevacao-zoonoses-design.md`

---

## FRENTE A — Dashboard: nivelamento visual

Repo: `zoonoses-inventory-dashboard`. Commits nesse repo.

### File structure
- Create: `src/components/auth/AuthLayout.tsx` — moldura split-panel (aside da marca + slot de conteúdo). Responsabilidade única: layout de auth.
- Modify: `src/pages/Login.tsx` — consumir `AuthLayout` (remover aside inline).
- Modify: `src/pages/Cadastrar.tsx`, `EsqueciSenha.tsx`, `RedefinirSenha.tsx`, `AguardandoAprovacao.tsx`, `AuthCallback.tsx` — envolver em `AuthLayout`.
- Modify: `src/pages/Conta.tsx`, `src/pages/UsuariosAdmin.tsx` — cabeçalho `font-display` + espaçamento v2.

### Task A1: Criar AuthLayout e migrar Login

**Files:**
- Create: `src/components/auth/AuthLayout.tsx`
- Modify: `src/pages/Login.tsx`

- [ ] **Step 1: Criar `AuthLayout.tsx`** extraindo o `<aside>` atual do Login (logo, headline, lista de features com ícones Activity/PackageCheck/ShieldCheck, gradientes radiais, rodapé) e um `<main className="has-aura ...">` com `children`. Props opcionais: `title?`, `subtitle?`, `aside?` (default = conteúdo institucional do Login). Estrutura base:

```tsx
import type { ReactNode } from 'react';
import { Boxes, Activity, PackageCheck, ShieldCheck } from 'lucide-react';

const FEATURES = [
  { icon: Activity, t: 'Atualização instantânea entre dispositivos' },
  { icon: PackageCheck, t: 'Alerta de estoque baixo e validade próxima' },
  { icon: ShieldCheck, t: 'Acesso controlado por papel e auditoria' },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        {/* gradientes + marca + FEATURES + rodapé — copiar do Login atual */}
      </aside>
      <main className="has-aura flex w-full flex-col items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm animate-fade-up">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Refatorar `Login.tsx`** para retornar `<AuthLayout>{conteúdo do formulário/MFA}</AuthLayout>`, removendo o `<div className="flex min-h-screen">`, o `<aside>` e o `<main>` agora no layout. Preservar toda a lógica (afterPassword, MFA, demo).
- [ ] **Step 3: Verificar** `npm run build` (tsc+vite) limpo. Expected: build success, sem erros de tipo.
- [ ] **Step 4: Commit** `git commit -m "refactor(auth): extrai AuthLayout compartilhado do Login"`

### Task A2: Aplicar AuthLayout às demais páginas de auth

**Files:** Modify `Cadastrar.tsx`, `EsqueciSenha.tsx`, `RedefinirSenha.tsx`, `AguardandoAprovacao.tsx`, `AuthCallback.tsx`

- [ ] **Step 1:** Em cada página, substituir o wrapper `<div className="has-aura flex min-h-screen ...">...<div className="w-full max-w-sm animate-fade-up">` por `<AuthLayout>` envolvendo só o conteúdo interno (cabeçalho + form). Remover o ícone Boxes duplicado no topo do card quando o aside já traz a marca (manter um cabeçalho textual `font-display`). Preservar 100% da lógica de cada página.
- [ ] **Step 2:** `npm run build` limpo.
- [ ] **Step 3:** Commit `git commit -m "feat(auth): nivela paginas de auth ao split-panel via AuthLayout"`

### Task A3: Polir páginas in-app (Conta, UsuariosAdmin)

**Files:** Modify `src/pages/Conta.tsx`, `src/pages/UsuariosAdmin.tsx`

- [ ] **Step 1:** Garantir cabeçalho de página padronizado (título `font-display text-2xl font-semibold tracking-tight` + subtítulo `text-sm text-muted-foreground`), espaçamento de seção consistente (`space-y-6`/`space-y-8`), e cards com a mesma borda/raio do resto do app. Não alterar lógica/dados.
- [ ] **Step 2:** `npm run build` + `npm run lint` limpos.
- [ ] **Step 3:** Commit `git commit -m "style(account,admin): alinha paginas in-app ao design system v2"`

### Task A4: Verificação visual E2E

- [ ] **Step 1:** Rodar `npm run dev`; via Playwright MCP navegar `/login`, `/cadastrar`, `/esqueci-senha`, `/aguardando-aprovacao`; confirmar split-panel presente em ≥lg e 0 erros de console. Capturar screenshot de `/cadastrar`.
- [ ] **Step 2:** Push: `git push origin main` (dispara deploy Pages). Alinhar `dev`: `git branch -f dev main && git push --force-with-lease origin dev`.

---

## FRENTE B — API Express: segurança

Repo: `zoonoses-inventory-api`. Commits nesse repo. Branch: `main`.

### File structure
- Modify: `app.js` — wiring de helmet, rate-limit, CORS allow-list, error handler.
- Create: `middleware/validate.js` — helper de validação (express-validator).
- Modify: `routes/*.js` — aplicar validadores nas rotas de escrita.
- Modify: `config/` ou ponto de boot — fail-fast de `JWT_SECRET`.
- Create: `__tests__/security.test.js` — testes de 429 (rate-limit) e 400 (validação).
- Modify: `package.json` — deps `helmet`, `express-rate-limit`, `express-validator`.

### Task B1: Instalar deps e wiring base de segurança

**Files:** Modify `package.json`, `app.js`

- [ ] **Step 1:** `cd zoonoses-inventory-api && npm i helmet express-rate-limit express-validator`
- [ ] **Step 2:** Editar `app.js`: adicionar no topo, antes das rotas:

```js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

app.use(helmet());

const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : {})); // dev: reflete origem; prod: allow-list

const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use(globalLimiter);
```

- [ ] **Step 3:** `npm test` continua verde (suíte existente). Expected: PASS.
- [ ] **Step 4:** Commit `git commit -m "feat(security): helmet, CORS allow-list e rate-limit global"`

### Task B2: Rate-limit estrito no login + fail-fast de segredo

**Files:** Modify `routes/usuario.js` (rota de login), boot/config

- [ ] **Step 1: Escrever teste falho** `__tests__/security.test.js`:

```js
const request = require('supertest');
const app = require('../app');

describe('seguranca', () => {
  it('limita tentativas de login (429 apos exceder)', async () => {
    let status;
    for (let i = 0; i < 12; i++) {
      const res = await request(app).post('/api/usuarios/login').send({ email: 'x@x.com', senha: 'errada' });
      status = res.status;
    }
    expect(status).toBe(429);
  });
});
```

- [ ] **Step 2: Rodar** `npx jest __tests__/security.test.js -t "limita tentativas"` → Expected: FAIL (sem limiter na rota).
- [ ] **Step 3: Implementar** limiter estrito na rota de login em `routes/usuario.js`:

```js
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
router.post('/login', loginLimiter, /* handler existente */);
```

- [ ] **Step 4: Rodar** o teste → Expected: PASS.
- [ ] **Step 5: Fail-fast de segredo:** no ponto onde o JWT é assinado/verificado (middleware ou controller), no boot garantir `if (!process.env.JWT_SECRET) { throw new Error('JWT_SECRET ausente') }` num módulo de config carregado por `app.js`. Ajustar testes para definir `JWT_SECRET` no setup (`.env.test`/jest setup) se necessário para não quebrar.
- [ ] **Step 6:** `npm test` verde. Commit `git commit -m "feat(security): rate-limit no login + fail-fast de JWT_SECRET"`

### Task B3: Validação de input nas rotas de escrita

**Files:** Create `middleware/validate.js`; Modify `routes/produto.js`, `routes/usuario.js`, `routes/entrada.js`, `routes/saida.js`

- [ ] **Step 1: Escrever teste falho** em `__tests__/security.test.js` (novo caso): POST `/api/produtos` com corpo vazio → espera 400.
- [ ] **Step 2: Rodar** → Expected: FAIL (hoje passa sem validar).
- [ ] **Step 3: Criar `middleware/validate.js`:**

```js
const { validationResult } = require('express-validator');
module.exports = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};
```

- [ ] **Step 4: Aplicar validadores** nas rotas de escrita (exemplo produto):

```js
const { body } = require('express-validator');
const validate = require('../middleware/validate');
router.post('/', body('nome').isString().trim().notEmpty(), validate, /* handler */);
```

Repetir o padrão mínimo (campos obrigatórios) para usuario (email/senha), entrada e saida (quantidade numérica > 0, ids presentes).

- [ ] **Step 5: Rodar** `npm test` → Expected: PASS (todos).
- [ ] **Step 6:** Commit `git commit -m "feat(security): validacao de input nas rotas de escrita"`

### Task B4: Error handler + push

**Files:** Modify `app.js`

- [ ] **Step 1:** Adicionar como ÚLTIMO middleware em `app.js`:

```js
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const body = { error: status === 500 && process.env.NODE_ENV === 'production' ? 'Erro interno' : err.message };
  res.status(status).json(body);
});
```

- [ ] **Step 2:** `npm test` verde. Atualizar README da api (seção de segurança: helmet/rate-limit/validação/CORS env).
- [ ] **Step 3:** Commit `git commit -m "feat(security): error handler central + doc"` e `git push origin main`.

---

## FRENTE C — Compose executável (api + system)

Repos: `zoonoses-inventory-api` (compose auto-contido + seed) e `controle-estoque-zoonoses` (system: submódulo + compose).

### File structure
- Create (api): `docker-compose.yml`, `scripts/seed.js` (ou ajustar se já existir em `scripts/`), `.env.example` (DATABASE_URL/JWT_SECRET/CORS_ORIGIN).
- Modify (api): `README.md` (seção `docker compose up`).
- Modify (system): `docker-compose.yml`, `README.md`; add submódulo `zoonoses-inventory-api`.

### Task C1: Seed idempotente na api

**Files:** Inspect `zoonoses-inventory-api/scripts/`; Create/Modify `scripts/seed.js`

- [ ] **Step 1:** Ler `scripts/` para ver se já há seed. Se não, criar `scripts/seed.js` que: importa `{ sequelize, ...models }` de `../models`, faz `await sequelize.sync()`, e se `Usuario.count() === 0` insere 1 usuário demo (senha via `bcrypt.hash`) + alguns Setor/Categoria/Produto de amostra. Idempotente (checa count antes).
- [ ] **Step 2:** Adicionar script em `package.json`: `"seed": "node scripts/seed.js"`.
- [ ] **Step 3:** Commit `git commit -m "feat(seed): popula usuario demo e dados de amostra (idempotente)"`

### Task C2: docker-compose auto-contido na api

**Files:** Create `zoonoses-inventory-api/docker-compose.yml`, `.env.example`

- [ ] **Step 1:** Criar `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: zoonoses_estoque
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]
    volumes: ["pg-data:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 10
  backend:
    build: .
    depends_on:
      db: { condition: service_healthy }
    environment:
      DATABASE_URL: postgres://postgres:postgres@db:5432/zoonoses_estoque
      JWT_SECRET: dev-secret-change-me
      CORS_ORIGIN: http://localhost:3000
      PORT: 3333
    ports: ["3001:3333"]
    command: sh -c "node scripts/seed.js && node server.js"
volumes:
  pg-data:
```

- [ ] **Step 2:** Confirmar que `config/` lê `DATABASE_URL` (Sequelize). Se hoje usa DB_HOST/DB_NAME separados, ajustar config para aceitar `DATABASE_URL` (Sequelize aceita string de conexão direta: `new Sequelize(process.env.DATABASE_URL)`).
- [ ] **Step 3:** `docker compose config` válido. Se Docker disponível na sessão: `docker compose up -d`, aguardar healthy, `curl localhost:3001/` → "API ... funcionando!", `docker compose down`.
- [ ] **Step 4:** Atualizar `README.md` da api com a seção. Commit `git commit -m "feat(docker): compose auto-contido api+db com seed"` e `git push`.

### Task C3: system com submódulo + compose

**Files:** Modify `controle-estoque-zoonoses/docker-compose.yml`, `README.md`; add submódulo

- [ ] **Step 1:** No repo `system`: `git submodule add https://github.com/LeonardoPCavalcanti/zoonoses-inventory-api.git zoonoses-inventory-api`
- [ ] **Step 2:** Reescrever `docker-compose.yml` do system: serviços `db` + `backend` (build `./zoonoses-inventory-api`), iguais ao da api mas com contexto do submódulo. Remover o serviço `frontend` (Gen 1 inexistente).
- [ ] **Step 3:** Atualizar `README.md`: instrução `git clone --recursive`; explicar que o system é o índice da Gen 1 e roda backend+db; a Gen 2 ao vivo é o dashboard (link demo). Remover a tabela que promete frontend rodando.
- [ ] **Step 4:** `docker compose config` válido. Commit `git commit -m "feat(docker): system roda backend+db via submodulo da api"` e `git push`.

---

## Self-review notes
- Cobertura do spec: A (visual)=Tasks A1–A4; B (segurança)=B1–B4; C (compose)=C1–C3. Todas as frentes mapeadas.
- Sem placeholders de lógica: código-base fornecido para AuthLayout, helmet/limiter, validate, compose, seed.
- Consistência: `AuthLayout` (mesma assinatura em A1/A2); `middleware/validate.js` exporta default usado em B3; `DATABASE_URL` consistente entre C2/C3.
- Risco conhecido: ambiente da sessão pode não ter Docker — nesse caso C valida por `docker compose config` + revisão, sem `up` real (documentado em C2/C3).
