import { useMemo, useState } from 'react';
import { Loader2, ShieldCheck, History, Users } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { EmptyState, ErrorState } from '@/components/shared/states';
import { useAuth } from '@/auth/AuthProvider';
import { ROLE_LABEL, assignableRoles, type Role } from '@/auth/roles';
import { canChangeRole, canChangeStatus } from '@/auth/userActions';
import {
  useAdminUsers, useUserAudit, useApproveUser, useRejectUser,
  useSetUserRole, useSetUserStatus,
} from '@/data/users';
import type { AdminUser, UserStatus } from '@/data/types';

const STATUS_BADGE: Record<UserStatus, string> = {
  ACTIVE: 'bg-primary/10 text-primary',
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  INACTIVE: 'bg-muted text-muted-foreground',
  REJECTED: 'bg-destructive/10 text-destructive',
};
const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: 'Ativo', PENDING: 'Pendente', INACTIVE: 'Inativo', REJECTED: 'Rejeitado',
};

export default function UsuariosAdmin() {
  const { profile } = useAuth();
  const actorRole = profile?.role ?? null;
  const actorId = profile?.id ?? null;
  const { data: users = [], isLoading, error } = useAdminUsers();

  const activeAdmins = users.filter((u) => u.role === 'ADMIN' && u.status === 'ACTIVE').length;
  const pendentes = users.filter((u) => u.status === 'PENDING');
  const geral = users.filter((u) => u.status !== 'PENDING');

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error) return <ErrorState error={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">Aprovação de cadastros e gestão de acesso.</p>
      </div>

      <Tabs defaultValue={pendentes.length ? 'pendentes' : 'todos'}>
        <TabsList>
          <TabsTrigger value="pendentes">
            Pendentes{pendentes.length > 0 && <Badge className="ml-2" variant="secondary">{pendentes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="mt-4">
          <PendingQueue users={pendentes} actorRole={actorRole} />
        </TabsContent>

        <TabsContent value="todos" className="mt-4">
          <UserTable users={geral} actorRole={actorRole} actorId={actorId} activeAdmins={activeAdmins} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PendingQueue({ users, actorRole }: { users: AdminUser[]; actorRole: Role | null }) {
  const approve = useApproveUser();
  const reject = useRejectUser();
  const [approving, setApproving] = useState<AdminUser | null>(null);
  const [role, setRole] = useState<Role | ''>('');
  const options = assignableRoles(actorRole);

  if (!users.length) {
    return <EmptyState icon={<Users className="h-6 w-6" />} title="Nenhum cadastro pendente"
      hint="Novas solicitações de acesso aparecem aqui." />;
  }

  return (
    <>
      <Card>
        <CardContent className="divide-y p-0">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{u.nome}</p>
                <p className="text-sm text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { setApproving(u); setRole(''); }}>Aprovar</Button>
                <Button size="sm" variant="outline" disabled={reject.isPending}
                  onClick={() => reject.mutate({ targetId: u.id })}>Rejeitar</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aprovar {approving?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Papel</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue placeholder="Selecione o papel" /></SelectTrigger>
              <SelectContent>
                {options.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproving(null)}>Cancelar</Button>
            <Button disabled={!role || approve.isPending}
              onClick={() => approving && role &&
                approve.mutate({ targetId: approving.id, role }, { onSuccess: () => setApproving(null) })}>
              {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar aprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function UserTable({
  users, actorRole, actorId, activeAdmins,
}: { users: AdminUser[]; actorRole: Role | null; actorId: string | null; activeAdmins: number }) {
  const setRole = useSetUserRole();
  const setStatus = useSetUserStatus();
  const [q, setQ] = useState('');
  const [auditFor, setAuditFor] = useState<AdminUser | null>(null);

  const filtered = useMemo(
    () => users.filter((u) =>
      [u.nome, u.email].some((s) => s.toLowerCase().includes(q.toLowerCase()))),
    [users, q],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Todos os usuários</CardTitle>
        <Input placeholder="Buscar por nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} className="mt-2 max-w-xs" />
      </CardHeader>
      <CardContent className="divide-y p-0">
        {filtered.map((u) => {
          const isSelf = u.id === actorId;
          const roleOpts = assignableRoles(actorRole);
          const lastAdmin = u.role === 'ADMIN' && u.status === 'ACTIVE' && activeAdmins <= 1;
          const canDeactivate = canChangeStatus(actorRole, u.role, 'INACTIVE', { isSelf, isLastActiveAdmin: lastAdmin }).ok;
          const canActivate = canChangeStatus(actorRole, u.role, 'ACTIVE', { isSelf, isLastActiveAdmin: false }).ok;
          const canEditRole = canChangeRole(actorRole, u.role, (roleOpts[0] ?? 'AUDITOR'), isSelf).ok;
          return (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  {u.nome}
                  {u.role === 'ADMIN' && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                </p>
                <p className="truncate text-sm text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={STATUS_BADGE[u.status]} variant="secondary">{STATUS_LABEL[u.status]}</Badge>
                <Select
                  value={u.role ?? ''}
                  onValueChange={(v) => setRole.mutate({ targetId: u.id, role: v as Role })}
                  disabled={isSelf || !canEditRole}
                >
                  <SelectTrigger className="h-8 w-44"><SelectValue placeholder={u.role ? ROLE_LABEL[u.role] : 'Sem papel'} /></SelectTrigger>
                  <SelectContent>
                    {roleOpts.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
                {u.status === 'ACTIVE' ? (
                  <Button size="sm" variant="outline" disabled={!canDeactivate || setStatus.isPending}
                    onClick={() => setStatus.mutate({ targetId: u.id, status: 'INACTIVE' })}>Desativar</Button>
                ) : (
                  <Button size="sm" variant="outline" disabled={!canActivate || u.status === 'REJECTED' || setStatus.isPending}
                    onClick={() => setStatus.mutate({ targetId: u.id, status: 'ACTIVE' })}>Ativar</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setAuditFor(u)} aria-label="Ver auditoria">
                  <History className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {!filtered.length && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</div>}
      </CardContent>

      <AuditSheet user={auditFor} onClose={() => setAuditFor(null)} />
    </Card>
  );
}

function AuditSheet({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const { data: entries = [], isLoading } = useUserAudit(user?.id ?? null);
  return (
    <Sheet open={!!user} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader><SheetTitle>Auditoria — {user?.nome}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-3">
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {!isLoading && !entries.length && <p className="text-sm text-muted-foreground">Sem registros.</p>}
          {entries.map((e) => (
            <div key={e.id} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{e.action}</p>
              <p className="text-muted-foreground">
                {[e.from_role && `${e.from_role}→${e.to_role}`, e.from_status && `${e.from_status}→${e.to_status}`, e.note]
                  .filter(Boolean).join(' · ')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString('pt-BR')}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
