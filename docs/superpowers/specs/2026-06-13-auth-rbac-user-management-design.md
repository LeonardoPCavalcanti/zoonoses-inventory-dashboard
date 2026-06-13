# Auth + Gestão de Usuários — Design (Zoonoses)

> Data: 2026-06-13 · Branch: `feat/auth-rbac-mfa` · Status: aprovado, pronto para planejamento

## Objetivo

Entregar o **subsistema completo de autenticação e controle de acesso** do painel
de estoque da Zoonoses, sobre a stack viva (**React + Vite + TS + shadcn/ui +
Supabase**), sem reescrever para um backend custom. Inclui: login com MFA,
cadastro público com aprovação, recuperação de senha, modelo RBAC de 5 papéis
com hierarquia, e um módulo administrativo de gestão de usuários.

Escopo desta entrega = **apenas** o subsistema de auth/usuários. Os demais módulos
do produto (FEFO, pedidos, fornecedores, relatórios PDF, código de barras, PWA)
ficam como roadmap de fases futuras, fora deste documento.

## Decisões de arquitetura

1. **Supabase Auth, não backend custom.** O Supabase já entrega JWT + refresh
   token, TOTP MFA, links de convite/recuperação single-use e hashing de senha
   (bcrypt) de forma testada. Não reimplementamos criptografia de auth.
2. **PKCE flow.** O cliente Supabase passa a `flowType: 'pkce'`. Links de e-mail
   chegam como `?code=…` (query) em vez de fragmento `#access_token`, evitando
   colisão com o **HashRouter** (o app é servido em subpath no GitHub Pages).
3. **`redirectTo` sempre derivado** de `window.location.origin + import.meta.env.BASE_URL`,
   para o subpath do GitHub Pages estar sempre correto (dev e produção).
4. **Mutações administrativas via Supabase Edge Functions** (Deno, service-role,
   server-side). Criar usuários para terceiros, enviar convites/aprovações e
   notificar admins exigem a service-role key, que **nunca** vai ao browser.
5. **Branch protegida.** Todo o trabalho em `feat/auth-rbac-mfa`. `main` faz deploy
   automático (GitHub Pages) — não recebe push até autorização explícita. O demo
   vivo permanece intacto.

### Mapeamento do spec original (Prisma/Fastify) → Supabase

O spec de referência assume um backend Fastify+Prisma. Mantemos o **comportamento**
exigido, mapeando para os equivalentes nativos do Supabase:

| Spec original | Implementação Supabase |
|---|---|
| `passwordHash` (bcrypt ≥12) | `auth.users` (gerido pelo Supabase; senha nunca tocada pelo app) |
| `inviteToken` / `inviteExpiry` (24h, single-use) | Links nativos `inviteUserByEmail` / `generateLink` (single-use, expiry no dashboard) |
| Endpoints `POST /auth/register`, `/admin/users/*` | Edge Functions + chamadas client-side RLS-guarded |
| Tabela `User` (Prisma) | Tabela `profiles` (já existe) + colunas novas |
| `AuditLog` para mudanças de role | Nova tabela `user_audit_log` (append-only) |

## Modelo de papéis (RBAC)

Enum de papéis, em ordem **decrescente** de poder (rank):

| Papel | Rank |
|---|---|
| `ADMIN` (Supervisor da Zoonoses) | 5 |
| `FINANCIAL_MANAGER` | 4 |
| `STOCKIST` | 3 |
| `NUCLEUS_SUPERVISOR` | 2 |
| `AUDITOR` | 1 |

Regra de hierarquia (`canManage(actor, target)`): um usuário só gerencia (editar
role, ativar, desativar, redefinir senha) usuários com rank **estritamente menor**
que o seu. Nunca a própria role; nunca mesmo nível ou superior.

Status de conta: `PENDING · ACTIVE · INACTIVE · REJECTED`.

Migração de linhas existentes: `admin → ADMIN`, `operador → STOCKIST`,
conta demo → `STOCKIST` (operacional, abaixo de admin, não gerencia ninguém).

## Schema (nova migração Postgres)

Arquivo: `supabase/migrations/2026061300000X_auth_rbac.sql` (não aplicado por mim).

- `profiles` ganha: `role` (enum novo, nullable — PENDING não tem role),
  `status` (enum, default `PENDING`), `sector text`, `rejection_note text`,
  `created_by uuid references profiles(id)`, `last_login_at timestamptz`.
- Novo enum `user_role` (5 valores acima) e `user_status` (4 valores).
- Função `role_rank(user_role) → int` (imutável) para comparações de hierarquia.
- Nova tabela **`user_audit_log`** (append-only): `id, actor_id, target_id,
  action, from_role, to_role, from_status, to_status, note, created_at`.
  Sem UPDATE/DELETE via policy. Lida por ADMIN e AUDITOR.
- **Trigger `prevent_last_admin_change`**: bloqueia desativar/rebaixar o último
  ADMIN ativo (rule #1). Bloqueia também auto-rebaixamento (rule #2) como defesa.
- **Reescrita das RLS** (substitui a lógica `papel = 'admin'`):
  - Usuário `status != ACTIVE` → sem acesso a dados de negócio.
  - `profiles`: cada um lê o próprio; `ADMIN` lê todos.
  - Capacidades de escrita nos dados de estoque mapeadas por role (ver `roles.ts`).
- Mantém realtime/policies existentes funcionando após o remapeamento.

## Frontend

### Cliente Supabase
`src/lib/supabase.ts`: adicionar `flowType: 'pkce'` em `auth`.

### Camada de autorização (lógica pura, testável)
`src/auth/roles.ts`:
- `Role`, `ROLE_RANK`, `canManage(actorRole, targetRole)`.
- Matriz `PERMISSIONS: Record<Role, Capability[]>` (ex.: `manage_users`,
  `approve_orders`, `manage_stock`, `view_reports`, `read_only`).
- `hasPermission(role, capability)`.

`src/auth/password.ts`: `validatePassword(pwd) → { ok, errors[] }`
(≥8, contém letra e número — rule #7).

`src/auth/loginState.ts`: máquina de estados pura do login
(`password → mfa_challenge? → blocked(status) → done`), testável sem rede.

### AuthProvider (estendido)
`src/auth/AuthProvider.tsx`:
- Carrega `profile` com `role`/`status`.
- Após `SIGNED_IN`: se `status !== 'ACTIVE'` → `signOut()` + sinaliza motivo
  (`PENDING` / `INACTIVE`) para a tela de login exibir a mensagem exata.
- Escuta `PASSWORD_RECOVERY` → roteia para `/redefinir-senha`.
- Expõe `can(capability)` e `role`.

### Rotas / páginas (identidade teal/Fraunces existente)
- `/login` — refinada: links p/ cadastro e "esqueci senha"; passo de **desafio
  MFA** (6 dígitos via `input-otp`) quando o Supabase reporta AAL2 necessário.
- `/cadastrar` — cadastro público → cria conta `PENDING` (sem role) → tela
  "aguarde aprovação".
- `/esqueci-senha` — `resetPasswordForEmail(email, { redirectTo })`.
- `/redefinir-senha` — `updateUser({ password })` (sessão de recovery ativa).
- `/auth/callback` — `exchangeCodeForSession`, roteia por intenção
  (recovery → redefinir; convite/confirm → app ou definir senha).
- `/conta` — segurança: trocar senha + **enroll/unenroll MFA TOTP** (QR + verify).
- `/admin/usuarios` — painel (ADMIN): tabela (nome, e-mail, role, status,
  cadastro, último acesso), busca + filtros por role/status. Ações: editar role
  (dropdown só com roles abaixo), ativar/desativar, redefinir senha, ver auditoria.
- `/admin/usuarios/novo` — criação direta (ADMIN): nome, e-mail, role (abaixo da
  própria), setor opcional → conta `ACTIVE` + e-mail de definição de senha.
- `/admin/usuarios/pendentes` — fila de aprovações: Aprovar (modal seleciona
  role) / Rejeitar (motivo opcional).
- `/admin/usuarios/:id/auditoria` — log filtrado pelo usuário.

`ProtectedRoute` ganha prop opcional `requirePermission`/`requireRole`; a navegação
(AppShell) revela itens admin só para quem tem `manage_users`.

## Edge Functions (Deno, service-role)

Pasta `supabase/functions/`:
- `notify-admins-on-register` — disparada no cadastro: e-mail a todos os ADMIN.
- `admin-create-user` — cria auth user + profile `ACTIVE` + envia convite (link
  de definição de senha 24h). Valida hierarquia do chamador.
- `approve-user` — define role + `ACTIVE`, gera link de definição de senha, envia
  e-mail (inclui nome do aprovador, role atribuída, link — rule #6). Audita.
- `reject-user` — `REJECTED` + `rejection_note`, e-mail ao solicitante. Audita.
- `set-role` — altera role respeitando `canManage` + last-admin + não-self. Audita.
- `set-status` — ativa/desativa (soft delete) com as mesmas proteções. Audita.
- `admin-reset-password` — força e-mail de redefinição.
- `expire-pending` — **agendada (pg_cron, diária 08:00)**: PENDING > 7 dias →
  `REJECTED` (rule: expiração automática).

Cada função valida o JWT do chamador, recarrega o profile do ator no servidor
(não confia em claims do cliente), aplica as regras de hierarquia e grava
`user_audit_log`. Regras críticas duplicadas como trigger no banco (defesa em
profundidade).

## Mensagens de login (rule #4)
- `PENDING` → "Sua conta aguarda aprovação."
- `INACTIVE` → "Conta desativada — entre em contato com o administrador."
- `REJECTED` → "Solicitação de acesso não aprovada."

## Testes (TDD — Vitest)
Adicionar Vitest + `@testing-library/react`. Cobertura da lógica pura:
- `roles.ts`: `canManage` em toda a matriz de ranks; `hasPermission`.
- `password.ts`: `validatePassword` (limites, letra+número).
- `loginState.ts`: transições password → mfa → blocked/done.
- guarda de **último admin** (função pura espelhando o trigger).
- Edge Functions: testes de handler com cliente admin do Supabase mockado
  (aprovar respeita hierarquia; rejeitar grava nota; last-admin bloqueado).

UI: smoke render das páginas novas (montam sem crash, campos presentes).

## Itens diferidos (dependem de config/credencial sua)
Construídos agora, **aplicados/configurados depois** (documentados no fim):
1. Aplicar a migração ao Supabase vivo (`supabase db push` ou MCP com seu OK).
2. Deploy das Edge Functions + secrets (service-role, SMTP).
3. Habilitar confirmação de e-mail + MFA(TOTP) no dashboard.
4. Templates de e-mail PT-BR (convite, aprovação, rejeição, recuperação).
5. Agendar `expire-pending` via pg_cron.
6. Allow-list de redirect: URL do GitHub Pages + `localhost` dev.
7. SMTP de produção (o sender default do Supabase é limitado).

## Fora de escopo
Demais módulos do produto (estoque avançado/FEFO, pedidos, fornecedores,
relatórios, código de barras, PWA). Bloqueio de login de INACTIVE via Supabase
Auth Hook fica como hardening futuro (agora: signOut no app + RLS como backstop).

## Plano de fases (para o writing-plans)
- **Fase 1 — Núcleo de auth:** migração de roles/status + RLS, `roles.ts`/
  `password.ts`/`loginState.ts` (com testes), cliente PKCE, AuthProvider estendido,
  páginas login(+MFA)/cadastrar/esqueci/redefinir/callback/conta. Entregável e
  testável isoladamente.
- **Fase 2 — Gestão de usuários:** Edge Functions, painel admin + fila de
  aprovação + criação direta + auditoria, `user_audit_log`, trigger last-admin,
  `expire-pending`.
