import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePedidosAtrasados } from '@/data/pedidos';
import { DIAS_ATRASO } from '@/pedidos/relatorio';

function diasParados(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

/** Aviso para analistas: pedidos parados em análise além do limite. */
export function AlertaAtrasados() {
  const atrasados = usePedidosAtrasados(DIAS_ATRASO);
  const lista = atrasados.data ?? [];
  if (lista.length === 0) return null;

  return (
    <Card className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          {lista.length} pedido(s) parado(s) em análise há mais de {DIAS_ATRASO} dias
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-amber-500/20">
          {lista.map((p) => (
            <li key={p.id} className="py-1.5">
              <Link to={`/pedidos/${p.id}`} className="flex items-center justify-between text-sm hover:underline">
                <span className="font-mono">{p.codigo}</span>
                <span className="text-muted-foreground">{p.nucleo?.nome ?? '—'} · há {diasParados(p.created_at)} dias</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
