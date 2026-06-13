// Chaves centralizadas do TanStack Query — também usadas pelo realtime
// para invalidar os caches certos quando o Postgres muda.
export const qk = {
  estoque: ['estoque'] as const,
  produtos: ['produtos'] as const,
  lotes: (produtoId?: string) => (produtoId ? (['lotes', produtoId] as const) : (['lotes'] as const)),
  movimentacoes: ['movimentacoes'] as const,
  setores: ['setores'] as const,
  categorias: ['categorias'] as const,
  fornecedores: ['fornecedores'] as const,
  dashboard: ['dashboard'] as const,
  adminUsers: ['admin-users'] as const,
  userAudit: (id: string) => ['user-audit', id] as const,
};
