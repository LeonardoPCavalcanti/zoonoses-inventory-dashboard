export type Role =
  | 'ADMIN'
  | 'FINANCIAL_MANAGER'
  | 'STOCKIST'
  | 'NUCLEUS_SUPERVISOR'
  | 'AUDITOR';

export const ROLE_RANK: Record<Role, number> = {
  ADMIN: 5,
  FINANCIAL_MANAGER: 4,
  STOCKIST: 3,
  NUCLEUS_SUPERVISOR: 2,
  AUDITOR: 1,
};

/** Rótulo legível em PT-BR para exibição na UI. */
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Supervisor da Zoonoses',
  FINANCIAL_MANAGER: 'Gestor Financeiro',
  STOCKIST: 'Estoquista',
  NUCLEUS_SUPERVISOR: 'Supervisor do Núcleo',
  AUDITOR: 'Auditor',
};

export type Capability =
  | 'manage_users'
  | 'approve_orders'
  | 'manage_stock'
  | 'view_reports'
  | 'view_audit';

export const PERMISSIONS: Record<Role, Capability[]> = {
  ADMIN: ['manage_users', 'approve_orders', 'manage_stock', 'view_reports', 'view_audit'],
  FINANCIAL_MANAGER: ['approve_orders', 'view_reports', 'view_audit'],
  STOCKIST: ['manage_stock', 'view_reports'],
  NUCLEUS_SUPERVISOR: ['view_reports'],
  AUDITOR: ['view_reports', 'view_audit'],
};

export function hasPermission(role: Role | null, cap: Capability): boolean {
  if (!role) return false;
  return PERMISSIONS[role].includes(cap);
}

/** Ator gerencia alvo só com rank estritamente maior. Alvo sem role = rank 0. */
export function canManage(actor: Role | null, target: Role | null): boolean {
  if (!actor) return false;
  const a = ROLE_RANK[actor];
  const t = target ? ROLE_RANK[target] : 0;
  return a > t;
}

/** Papéis que o ator pode atribuir — estritamente abaixo do seu rank. */
export function assignableRoles(actor: Role | null): Role[] {
  if (!actor) return [];
  const a = ROLE_RANK[actor];
  return (Object.keys(ROLE_RANK) as Role[]).filter((r) => ROLE_RANK[r] < a);
}
