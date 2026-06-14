import type { Role } from '@/auth/roles';
import type { PedidoStatus, PedidoItem } from '@/data/types';

export const STATUS_LABEL: Record<PedidoStatus, string> = {
  AGUARDANDO_ANALISE: 'Aguardando análise',
  EM_REVISAO: 'Em revisão',
  APROVADO: 'Aprovado',
  REJEITADO: 'Rejeitado',
  ENVIADO: 'Enviado',
  CONCLUIDO: 'Concluído',
  CONCLUIDO_PARCIAL: 'Concluído (parcial)',
};

/** Variante de Badge do shadcn por status. */
export function statusVariant(s: PedidoStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'REJEITADO') return 'destructive';
  if (s === 'CONCLUIDO') return 'default';
  if (s === 'AGUARDANDO_ANALISE' || s === 'ENVIADO') return 'secondary';
  return 'outline';
}

/** "Vacina, Soro, Luva e mais N itens" a partir dos itens do pedido. */
export function resumoItens(itens: Pick<PedidoItem, 'produto'>[]): string {
  const nomes = itens.map((i) => i.produto?.nome ?? 'Item');
  const head = nomes.slice(0, 3).join(', ');
  const resto = nomes.length - 3;
  if (resto <= 0) return head;
  return `${head} e mais ${resto} ${resto === 1 ? 'item' : 'itens'}`;
}

const ANALISTA: Role[] = ['ADMIN', 'FINANCIAL_MANAGER'];

export function canAnalisar(role: Role | null, status: PedidoStatus): boolean {
  return !!role && ANALISTA.includes(role) && status === 'AGUARDANDO_ANALISE';
}

export function canDespachar(role: Role | null, status: PedidoStatus): boolean {
  return (role === 'STOCKIST' || role === 'ADMIN') && status === 'APROVADO';
}

export function canConfirmarRemetente(role: Role | null, status: PedidoStatus, jaConfirmou: boolean): boolean {
  return (role === 'STOCKIST' || role === 'ADMIN') && status === 'ENVIADO' && !jaConfirmou;
}

export function canConfirmarDestinatario(
  role: Role | null, status: PedidoStatus, isOwner: boolean, jaConfirmou: boolean,
): boolean {
  return role === 'NUCLEUS_SUPERVISOR' && isOwner && status === 'ENVIADO' && !jaConfirmou;
}
