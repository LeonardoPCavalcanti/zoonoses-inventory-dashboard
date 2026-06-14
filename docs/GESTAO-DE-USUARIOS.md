# Gestão de Usuários — Guia de Operação e Configuração

Documento de referência do subsistema de autenticação, controle de acesso e
gestão de usuários do painel de estoque da Zoonoses. Cobre o modelo de papéis,
os fluxos implementados, a operação do painel administrativo e a configuração
pendente no Supabase Dashboard.

Stack: React + Vite + TypeScript + shadcn/ui + Supabase (Auth, Postgres/RLS,
Edge Functions, pg_cron). Toda a autorização é validada no banco (RLS + funções
`SECURITY DEFINER`); a UI apenas reflete e antecipa essas regras.

---

## 1. Modelo de papéis (RBAC)

Cinco papéis, em ordem decrescente de poder (rank). A hierarquia é estrita: um
usuário só gerencia outro de rank **estritamente menor** que o seu, e nunca a si
mesmo.

| Papel (`user_role`) | Rótulo na UI | Rank | Capacidades |
|---|---|---|---|
| `ADMIN` | Supervisor da Zoonoses | 5 | manage_users, approve_orders, manage_stock, view_reports, view_audit |
| `FINANCIAL_MANAGER` | Gestor Financeiro | 4 | approve_orders, view_reports, view_audit |
| `STOCKIST` | Estoquista | 3 | manage_stock, view_reports |
| `NUCLEUS_SUPERVISOR` | Supervisor do Núcleo | 2 | view_reports |
| `AUDITOR` | Auditor | 1 | view_reports, view_audit |

Status da conta (`user_status`): `PENDING`, `ACTIVE`, `INACTIVE`, `REJECTED`.
Apenas contas `ACTIVE` acessam dados de negócio (garantido por RLS, não só pela
UI). A capacidade `manage_users` (somente `ADMIN`) controla o acesso ao painel
`/admin/usuarios` e ao item de navegação correspondente.

Fonte da verdade do modelo no código: `src/auth/roles.ts` (puro, testado).

---

## 2. Fluxos implementados

### 2.1 Auto-cadastro com aprovação
1. A pessoa acessa `/cadastrar`, informa nome, e-mail e senha.
2. Um trigger (`handle_new_user`) cria o profile como `PENDING` com `role` nula.
3. A tela `/aguardando-aprovacao` encerra a sessão (a conta não acessa nada
   enquanto pendente).
4. Um `ADMIN` aprova em `/admin/usuarios` (aba Pendentes), atribuindo um papel.
   A pessoa passa a `ACTIVE` e já entra com a senha definida no cadastro.

### 2.2 Criação direta por administrador
1. Em `/admin/usuarios` (aba Todos), o `ADMIN` usa **Novo usuário**.
2. A Edge Function `admin-create-user` valida o chamador, cria a conta já
   `ACTIVE` com o papel escolhido e retorna um **link de definição de senha**.
3. O `ADMIN` copia o link e o repassa à pessoa (por enquanto manualmente; o
   envio automático por e-mail depende de SMTP — ver Seção 4).

### 2.3 Gestão contínua
No painel, o `ADMIN` pode: mudar o papel (apenas para papéis abaixo do seu),
ativar/desativar (soft delete) e consultar a auditoria por usuário. Todas as
ações são gravadas em `user_audit_log` (append-only).

### 2.4 Recuperação de senha e MFA
- Recuperação: `/esqueci-senha` -> e-mail com link -> `/redefinir-senha`.
- MFA TOTP: cada usuário ativa/desativa em `/conta`; o login exige o código de
  6 dígitos quando o fator está habilitado.

### 2.5 Expiração automática
Um job `pg_cron` (`expire-pending-users`, diário às 08:00 UTC) marca como
`REJECTED` qualquer cadastro `PENDING` parado há mais de 7 dias.

---

## 3. Garantias de segurança (defesa em profundidade)

- **Mutações administrativas** rodam em funções `SECURITY DEFINER`
  (`approve_user`, `reject_user`, `set_user_role`, `set_user_status`) que
  recarregam o papel do ator do banco — nunca confiam em claims do cliente — e
  aplicam hierarquia, regra do último-admin e a proibição de auto-edição.
- **Último administrador**: além da checagem nas funções, o trigger
  `prevent_last_admin_change` impede rebaixar/desativar o último `ADMIN` ativo.
- **Leitura de usuários**: `admin_list_users` e `admin_user_audit` só retornam
  dados para `ADMIN`/`AUDITOR`; o cliente nunca lê `user_audit_log` diretamente
  (RLS habilitada sem policies — acesso exclusivamente via RPC).
- **Edge Function** com `verify_jwt` ativo e revalidação de `ADMIN` no servidor.

---

## 4. Configuração pendente no Supabase Dashboard

Itens que dependem de acesso ao Dashboard (não versionáveis no repositório).
Projeto: `vkjmewxojzhxillkjfft`.

### 4.1 Necessário para os fluxos por e-mail funcionarem
1. **Authentication > URL Configuration > Redirect URLs**: adicionar
   - `https://leonardopcavalcanti.github.io/zoonoses-inventory-dashboard/**`
   - `http://localhost:8080/**` e `http://localhost:8081/**` (desenvolvimento)
   Sem isto, os links de recuperação/definição de senha redirecionam para a
   Site URL padrão em vez de voltarem ao app.
2. **Authentication > Providers > Email**: habilitar **Confirm email** (confirmação
   de e-mail no cadastro), se desejado.
3. **Authentication > Emails**: personalizar os templates (convite, recuperação,
   confirmação) em PT-BR.
4. **SMTP de produção** (Project Settings > Authentication > SMTP): configurar um
   provedor (ex.: Resend, SendGrid). O remetente padrão do Supabase é limitado e
   só entrega para membros do projeto. Necessário para automatizar o envio dos
   links (Seção 2.2) e futuros e-mails de aprovação/rejeição.

### 4.2 Recomendado (hardening)
5. **Authentication > Multi-Factor**: habilitar **TOTP**.
6. **Authentication > Password Security**: habilitar **Leaked password protection**
   (checagem contra HaveIBeenPwned).

### 4.3 Hardening futuro (opcional)
7. **Auth Hook** para bloquear login de contas `INACTIVE` no nível de emissão de
   token (hoje o bloqueio é feito no app via `signOut` + RLS como backstop).

---

## 5. Roadmap remanescente

Construído e ao vivo: Fases 1 (auth core + MFA), 2a (painel admin via RPC) e 2b
(criação direta sem SMTP + expiração via pg_cron).

Pendente, dependente de configuração:
- E-mails automáticos (convite na criação direta; aviso a admins em novos
  cadastros; e-mails de aprovação/rejeição) — requer SMTP (Seção 4.1).
- Auth Hook de bloqueio de `INACTIVE` (Seção 4.3).

Notificação de novos cadastros hoje é in-app: o badge de contagem na aba
Pendentes do painel.

---

## 6. Mapa de arquivos

| Área | Caminho |
|---|---|
| Modelo de papéis / capacidades (puro) | `src/auth/roles.ts`, `src/auth/userActions.ts` |
| Estado de login / senha (puro) | `src/auth/loginState.ts`, `src/auth/password.ts` |
| Provedor de auth | `src/auth/AuthProvider.tsx`, `src/auth/ProtectedRoute.tsx` |
| Páginas públicas | `src/pages/{Login,Cadastrar,AguardandoAprovacao,EsqueciSenha,RedefinirSenha,AuthCallback}.tsx` |
| Conta / segurança | `src/pages/Conta.tsx` |
| Painel administrativo | `src/pages/UsuariosAdmin.tsx`, `src/data/users.ts` |
| Edge Function | `supabase/functions/admin-create-user/index.ts` |
| Migrações (auth + gestão) | `supabase/migrations/20260613*` |
| Especificação e planos | `docs/superpowers/specs/2026-06-13-*`, `docs/superpowers/plans/2026-06-13-*` |
