# Gestão de Usuários — Fase 2b (sem SMTP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Completar a gestão de usuários sem depender de SMTP — criação direta de usuário por admin (gera link de definição de senha exibido no painel) e auto-expiração de cadastros PENDING antigos via pg_cron.

**Architecture:** `admin-create-user` é uma Edge Function (Deno, service-role auto-injetado) que valida o chamador ADMIN, cria o auth user, promove o profile a ACTIVE com papel, audita e retorna um `action_link` (via `generateLink`, sem enviar e-mail). `expire-pending` é função SQL agendada por pg_cron. Notificação de novos cadastros = in-app (badge de pendentes já existe).

**Tech Stack:** Supabase Edge Functions (Deno) · pg_cron · supabase-js v2 · React + React Query · shadcn/ui.

**Escopo fora desta fase:** e-mails automáticos (convite/aprovação/rejeição/aviso a admins) — dependem de SMTP que o Leo configura; Auth Hook de bloqueio de INACTIVE no login (config de Dashboard).

---

### Task 1: expire-pending via pg_cron

**Files:** Create `supabase/migrations/20260613000008_expire_pending.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Auto-rejeita cadastros PENDING parados há mais de 7 dias.
create extension if not exists pg_cron;

create or replace function public.expire_pending_users()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
    set status = 'REJECTED',
        rejection_note = coalesce(rejection_note, 'Expirado: aprovação não concluída em 7 dias')
    where status = 'PENDING' and created_at < now() - interval '7 days';
end; $$;
revoke execute on function public.expire_pending_users() from public, anon, authenticated;

-- Agenda diária às 08:00 UTC (idempotente: remove agendamento anterior se existir).
select cron.unschedule('expire-pending-users')
  where exists (select 1 from cron.job where jobname = 'expire-pending-users');
select cron.schedule('expire-pending-users', '0 8 * * *', $$select public.expire_pending_users()$$);
```

- [ ] **Step 2: Apply** via MCP `apply_migration` (name `expire_pending`). Expected: success.

- [ ] **Step 3: Verify** via `execute_sql`:
```sql
select
  (select exists(select 1 from pg_extension where extname='pg_cron')) as pgcron,
  (select schedule from cron.job where jobname='expire-pending-users') as sched;
-- Smoke da lógica (rollback automático): cria PENDING antigo e confirma expiração.
do $$ begin
  perform public.expire_pending_users();
  raise notice 'expire_pending_users executou sem erro';
end $$;
```
Expected: `pgcron=true`, `sched='0 8 * * *'`, NOTICE ok.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260613000008_expire_pending.sql
git commit -m "feat(users): expire-pending via pg_cron (auto-rejeita PENDING > 7 dias)"
```

---

### Task 2: Edge Function `admin-create-user`

**Files:** Create `supabase/functions/admin-create-user/index.ts`

- [ ] **Step 1: Write the function**

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const RANK: Record<string, number> = {
  ADMIN: 5, FINANCIAL_MANAGER: 4, STOCKIST: 3, NUCLEUS_SUPERVISOR: 2, AUDITOR: 1,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido' });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    // Identifica o chamador pelo JWT.
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uerr } = await userClient.auth.getUser();
    if (uerr || !user) return json(401, { error: 'Não autenticado' });

    const admin = createClient(url, serviceKey);

    // Só ADMIN ativo cria usuários.
    const { data: actor } = await admin.from('profiles').select('role,status').eq('id', user.id).single();
    if (!actor || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') {
      return json(403, { error: 'Apenas administradores podem criar usuários' });
    }

    const body = await req.json().catch(() => ({}));
    const nome = (body.nome ?? '').trim();
    const email = (body.email ?? '').trim().toLowerCase();
    const role = body.role as string;
    const sector = body.sector ? String(body.sector) : null;
    if (!nome || !email || !role) return json(400, { error: 'Campos obrigatórios: nome, email, papel' });
    if (!RANK[role] || RANK[role] >= RANK['ADMIN']) return json(400, { error: 'Papel inválido' });

    // Cria o usuário (e-mail confirmado; senha definida depois via link).
    const { data: created, error: cerr } = await admin.auth.admin.createUser({
      email, email_confirm: true, user_metadata: { nome },
    });
    if (cerr || !created.user) return json(400, { error: cerr?.message ?? 'Falha ao criar usuário' });

    // O trigger criou o profile PENDING; promove a ACTIVE com papel.
    const { error: perr } = await admin.from('profiles')
      .update({ role, status: 'ACTIVE', sector, created_by: user.id })
      .eq('id', created.user.id);
    if (perr) return json(400, { error: perr.message });

    await admin.from('user_audit_log').insert({
      actor_id: user.id, target_id: created.user.id, action: 'admin_create',
      to_role: role, to_status: 'ACTIVE', note: sector,
    });

    // Link de definição de senha (NÃO envia e-mail; admin repassa ao usuário).
    const redirectTo = body.redirectTo ? String(body.redirectTo) : undefined;
    const { data: link } = await admin.auth.admin.generateLink({
      type: 'recovery', email, options: redirectTo ? { redirectTo } : undefined,
    });

    return json(200, { ok: true, userId: created.user.id, link: link?.properties?.action_link ?? null });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
```

- [ ] **Step 2: Deploy** via MCP `deploy_edge_function` (name `admin-create-user`). Expected: success. (Service-role/anon/url são secrets default do runtime — sem config do Leo.)

- [ ] **Step 3: Verify guard** — invocar sem JWT válido deve retornar 401. Via `execute_sql` não dá; testar no walkthrough (Task 4) com admin logado. Confirmar deploy com MCP `list_edge_functions` (a função aparece como ACTIVE).

- [ ] **Step 4: Commit**
```bash
git add supabase/functions/admin-create-user/index.ts
git commit -m "feat(users): Edge Function admin-create-user (link sem SMTP)"
```

---

### Task 3: UI "Novo usuário"

**Files:** Modify `src/data/users.ts` (hook `useCreateUser`); Modify `src/pages/UsuariosAdmin.tsx` (botão + dialog no cabeçalho do tab Todos).

- [ ] **Step 1: Add the hook** (em `src/data/users.ts`)

```ts
import { authRedirectUrl } from '@/auth/redirect';

export interface CreateUserResult { ok: boolean; userId: string; link: string | null }

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { nome: string; email: string; role: Role; sector?: string | null }): Promise<CreateUserResult> => {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { ...vars, redirectTo: authRedirectUrl() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as CreateUserResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.adminUsers });
      toast.success('Usuário criado');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
```

- [ ] **Step 2: Add the dialog** ao `UserTable` em `UsuariosAdmin.tsx`: um botão "Novo usuário" no header do card e um `Dialog` com campos nome/e-mail/papel (Select com `assignableRoles`)/setor. Ao concluir, exibe o `link` retornado num bloco com botão "Copiar link" (usa `navigator.clipboard.writeText`). Importar `useCreateUser` e `useState`. Estrutura:

```tsx
// imports adicionais
import { useCreateUser } from '@/data/users';
// dentro de UserTable:
const createUser = useCreateUser();
const [novo, setNovo] = useState(false);
const [form, setForm] = useState({ nome: '', email: '', role: '' as Role | '', sector: '' });
const [linkGerado, setLinkGerado] = useState<string | null>(null);

// botão no CardHeader, ao lado do título:
<Button size="sm" onClick={() => { setNovo(true); setLinkGerado(null); setForm({ nome:'', email:'', role:'', sector:'' }); }}>
  Novo usuário
</Button>

// Dialog (renderizar no fim do componente):
<Dialog open={novo} onOpenChange={(o) => !o && setNovo(false)}>
  <DialogContent>
    <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
    {linkGerado ? (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Usuário criado. Envie este link para a pessoa definir a senha:</p>
        <div className="flex items-center gap-2">
          <Input readOnly value={linkGerado} className="text-xs" />
          <Button size="sm" onClick={() => { void navigator.clipboard.writeText(linkGerado); toast.success('Link copiado'); }}>Copiar</Button>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => setNovo(false)}>Fechar</Button></DialogFooter>
      </div>
    ) : (
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Nome</Label><Input value={form.nome} onChange={(e)=>setForm(f=>({...f,nome:e.target.value}))} /></div>
        <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e)=>setForm(f=>({...f,email:e.target.value}))} /></div>
        <div className="space-y-1.5"><Label>Papel</Label>
          <Select value={form.role} onValueChange={(v)=>setForm(f=>({...f,role:v as Role}))}>
            <SelectTrigger><SelectValue placeholder="Selecione o papel" /></SelectTrigger>
            <SelectContent>{assignableRoles(actorRole).map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Setor (opcional)</Label><Input value={form.sector} onChange={(e)=>setForm(f=>({...f,sector:e.target.value}))} /></div>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>setNovo(false)}>Cancelar</Button>
          <Button disabled={!form.nome || !form.email || !form.role || createUser.isPending}
            onClick={()=>createUser.mutate(
              { nome: form.nome, email: form.email, role: form.role as Role, sector: form.sector || null },
              { onSuccess: (r) => setLinkGerado(r.link) })}>
            {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
          </Button>
        </DialogFooter>
      </div>
    )}
  </DialogContent>
</Dialog>
```
`UserTable` precisa receber `actorRole` (já recebe). Garantir imports de `Label`, `Dialog*`, `Input`, `assignableRoles`, `ROLE_LABEL`, `Loader2` (a maioria já importada na página).

- [ ] **Step 3: Verify** `npx tsc --noEmit && npm run lint && npm run build`. Expected: limpos.

- [ ] **Step 4: Commit**
```bash
git add src/data/users.ts src/pages/UsuariosAdmin.tsx
git commit -m "feat(users): UI de criação direta de usuário (link sem SMTP)"
```

---

### Task 4: Verificação + walkthrough

- [ ] **Step 1:** `npx vitest run && npx tsc --noEmit && npm run lint && npm run build` — todos verdes.
- [ ] **Step 2:** Walkthrough Playwright: logar admin → /admin/usuarios → "Novo usuário" → preencher (papel AUDITOR) → Criar → confirmar que aparece o link e o usuário entra na lista como Ativo. Limpar o usuário de teste ao final (delete auth.users).
- [ ] **Step 3:** `get_advisors` (security) — sem novos WARNINGs além dos esperados.
- [ ] **Step 4:** Commit de ajuste se necessário.

---

## Self-Review
**Cobertura:** criação direta de usuário (Task 2+3) ✓; auto-expiração PENDING (Task 1) ✓; notificação in-app = badge existente ✓. **Diferido (SMTP/Dashboard):** e-mails automáticos, Auth Hook INACTIVE. **Consistência:** `admin-create-user` body `{nome,email,role,sector,redirectTo}` igual entre função (Task 2) e hook (Task 3); `action='admin_create'` novo valor de auditoria (texto livre, sem enum). **Placeholders:** nenhum.
