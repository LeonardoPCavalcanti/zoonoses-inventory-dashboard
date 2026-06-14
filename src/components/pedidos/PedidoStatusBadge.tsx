import { Badge } from '@/components/ui/badge';
import { STATUS_LABEL, statusVariant } from '@/pedidos/flow';
import type { PedidoStatus } from '@/data/types';

export function PedidoStatusBadge({ status }: { status: PedidoStatus }) {
  return <Badge variant={statusVariant(status)}>{STATUS_LABEL[status]}</Badge>;
}
