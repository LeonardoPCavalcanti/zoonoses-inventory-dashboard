import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/shared/states';
import { useMovimentacoes } from '@/data/movimentacoes';
import type { TipoMovimentacao } from '@/data/types';
import { useRealtime } from '@/hooks/useRealtime';
import { qk } from '@/lib/queryKeys';

const TIPO_LABEL: Record<TipoMovimentacao, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  ajuste: 'Ajuste',
};

export default function Auditoria() {
  const [filtro, setFiltro] = useState<'todos' | TipoMovimentacao>('todos');
  const movs = useMovimentacoes(200);

  useRealtime([
    {
      table: 'movimentacoes',
      keys: [qk.movimentacoes, qk.estoque],
      onChange: (payload) => {
        if (payload.eventType === 'INSERT') {
          toast.info('Nova movimentação registrada', { description: 'Auditoria atualizada em tempo real.' });
        }
      },
    },
  ]);

  if (movs.isError) return <ErrorState error={movs.error} />;

  const itens = (movs.data ?? []).filter((m) => filtro === 'todos' || m.tipo === filtro);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="entrada">Entradas</SelectItem>
            <SelectItem value="saida">Saídas</SelectItem>
            <SelectItem value="ajuste">Ajustes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {movs.isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={8} />
            </div>
          ) : itens.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sem movimentações" hint="As ações de estoque aparecem aqui em tempo real." />
            </div>
          ) : (
            <ol className="divide-y">
              {itens.map((m) => (
                <li key={m.id} className="flex items-start gap-3 p-4">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="flex-1">
                    <p className="text-sm">
                      <Badge
                        variant={m.tipo === 'saida' ? 'destructive' : m.tipo === 'entrada' ? 'default' : 'secondary'}
                        className="mr-2"
                      >
                        {TIPO_LABEL[m.tipo]}
                      </Badge>
                      <span className="font-medium">{m.produto?.nome ?? 'Produto'}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        — {m.quantidade} {m.produto?.unidade ?? ''}
                        {m.motivo ? ` · ${m.motivo}` : ''}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleString('pt-BR')} · {m.responsavel?.nome ?? 'sistema'}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
