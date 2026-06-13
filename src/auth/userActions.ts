import { type Role, ROLE_RANK, hasPermission } from './roles';

export interface Decision { ok: boolean; reason?: string }
const ok: Decision = { ok: true };
const no = (reason: string): Decision => ({ ok: false, reason });

/** Só quem tem manage_users (ADMIN) aprova cadastros. */
export function canApprove(actor: Role | null): boolean {
  return hasPermission(actor, 'manage_users');
}

/** Espelha set_user_role: ator ADMIN, não-self, alvo abaixo, novo papel abaixo. */
export function canChangeRole(
  actor: Role | null,
  target: Role | null,
  newRole: Role,
  isSelf: boolean,
): Decision {
  if (!hasPermission(actor, 'manage_users')) return no('Sem permissão para gerenciar usuários');
  if (isSelf) return no('Você não pode alterar seu próprio papel');
  const a = ROLE_RANK[actor as Role];
  if (target && ROLE_RANK[target] >= a) return no('Usuário de papel igual ou superior');
  if (ROLE_RANK[newRole] >= a) return no('Papel igual ou acima do seu');
  return ok;
}

/** Espelha set_user_status: ator ADMIN, não-self, alvo abaixo, last-admin. */
export function canChangeStatus(
  actor: Role | null,
  target: Role | null,
  newStatus: 'ACTIVE' | 'INACTIVE',
  ctx: { isSelf: boolean; isLastActiveAdmin: boolean },
): Decision {
  if (!hasPermission(actor, 'manage_users')) return no('Sem permissão para gerenciar usuários');
  if (ctx.isSelf) return no('Você não pode alterar seu próprio status');
  const a = ROLE_RANK[actor as Role];
  if (target && ROLE_RANK[target] >= a) return no('Usuário de papel igual ou superior');
  if (newStatus === 'INACTIVE' && target === 'ADMIN' && ctx.isLastActiveAdmin) {
    return no('Não é possível desativar o último administrador ativo');
  }
  return ok;
}
