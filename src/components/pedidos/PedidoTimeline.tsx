import { Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Pedido } from '@/data/types';

interface Etapa {
  label: string;
  done: boolean;
  detalhe?: string | null;
}

function dataHora(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;
}

/** Rastreador estilo Mercado Livre, com os dois lados do handshake de entrega. */
export function PedidoTimeline({ pedido }: { pedido: Pedido }) {
  const concluido = pedido.status === 'CONCLUIDO' || pedido.status === 'CONCLUIDO_PARCIAL';
  const etapas: Etapa[] = [
    { label: 'Criado', done: true, detalhe: dataHora(pedido.created_at) },
    {
      label: pedido.status === 'REJEITADO' ? 'Rejeitado' : 'Aprovado',
      done: ['APROVADO', 'ENVIADO', 'CONCLUIDO', 'CONCLUIDO_PARCIAL', 'REJEITADO'].includes(pedido.status),
      detalhe: dataHora(pedido.analisado_em),
    },
    { label: 'Enviado', done: ['ENVIADO', 'CONCLUIDO', 'CONCLUIDO_PARCIAL'].includes(pedido.status), detalhe: dataHora(pedido.enviado_em) },
    { label: 'Estoquista confirmou entrega', done: !!pedido.entrega_remetente_em, detalhe: dataHora(pedido.entrega_remetente_em) },
    { label: 'Núcleo confirmou recebimento', done: !!pedido.entrega_destinatario_em, detalhe: dataHora(pedido.entrega_destinatario_em) },
    { label: pedido.status === 'CONCLUIDO_PARCIAL' ? 'Concluído (parcial)' : 'Concluído', done: concluido, detalhe: null },
  ];

  return (
    <ol className="space-y-3">
      {etapas.map((e, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            className={cn(
              'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
              e.done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30 text-muted-foreground',
            )}
          >
            {e.done ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          </span>
          <div className="leading-tight">
            <p className={cn('text-sm font-medium', !e.done && 'text-muted-foreground')}>{e.label}</p>
            {e.detalhe && <p className="text-xs text-muted-foreground">{e.detalhe}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
