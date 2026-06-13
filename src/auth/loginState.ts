export type AccountStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'REJECTED';
export type Aal = 'aal1' | 'aal2' | null;

export type LoginOutcome =
  | { step: 'mfa_challenge' }
  | { step: 'blocked'; status: Exclude<AccountStatus, 'ACTIVE'> }
  | { step: 'done' };

export interface LoginContext {
  status: AccountStatus;
  currentLevel: Aal;
  nextLevel: Aal;
}

/** Decide o próximo passo após o sign-in com senha. Status é checado primeiro. */
export function nextLoginStep(ctx: LoginContext): LoginOutcome {
  if (ctx.status !== 'ACTIVE') {
    return { step: 'blocked', status: ctx.status };
  }
  if (ctx.nextLevel === 'aal2' && ctx.currentLevel === 'aal1') {
    return { step: 'mfa_challenge' };
  }
  return { step: 'done' };
}

export const STATUS_MESSAGE: Record<Exclude<AccountStatus, 'ACTIVE'>, string> = {
  PENDING: 'Sua conta aguarda aprovação.',
  INACTIVE: 'Conta desativada — entre em contato com o administrador.',
  REJECTED: 'Solicitação de acesso não aprovada.',
};
