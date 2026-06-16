import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ErrorState, TableSkeleton } from '@/components/shared/states';
import { PedidoStatusBadge } from '@/components/pedidos/PedidoStatusBadge';
import { AlertaAtrasados } from '@/components/pedidos/AlertaAtrasados';
import { usePedidos, type PedidoFiltros } from '@/data/pedidos';
import { montarLinhas, nomeArquivoRelatorio } from '@/pedidos/relatorio';
import { exportarExcel, exportarPdf } from '@/lib/export';
import { useNucleos } from '@/data/nucleos';
import { resumoItens, STATUS_LABEL } from '@/pedidos/flow';
import type { PedidoStatus } from '@/data/types';
import { useAuth } from '@/auth/AuthProvider';
import { useRealtime } from '@/hooks/useRealtime';
import { qk } from '@/lib/queryKeys';

function dataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Pedidos() {
  const { role } = useAuth();
  const [filtros, setFiltros] = useState<PedidoFiltros>({});
  const pedidos = usePedidos(filtros);
  const nucleos = useNucleos();
  useRealtime([{ table: 'pedidos', keys: [qk.pedidos, qk.pedidoContadores] }]);

  const podeCriar = role === 'NUCLEUS_SUPERVISOR' || role === 'ADMIN';
  const ehAnalista = role === 'ADMIN' || role === 'FINANCIAL_MANAGER';
  const lista = pedidos.data ?? [];
  const temLinhas = lista.length > 0;
  const baixarExcel = () => exportarExcel(montarLinhas(lista), nomeArquivoRelatorio('xlsx'));
  const baixarPdf = () => exportarPdf(montarLinhas(lista), nomeArquivoRelatorio('pdf'), 'Central de pedidos');

  if (pedidos.isError) return <ErrorState error={pedidos.error} />;

  return (
    <div className="space-y-4">
      {ehAnalista && <AlertaAtrasados />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar por código"
            className="w-48"
            value={filtros.busca ?? ''}
            onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value || undefined }))}
          />
          <Select value={filtros.status ?? 'all'} onValueChange={(v) => setFiltros((f) => ({ ...f, status: v === 'all' ? undefined : v }))}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {(Object.keys(STATUS_LABEL) as PedidoStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtros.nucleoId ?? 'all'} onValueChange={(v) => setFiltros((f) => ({ ...f, nucleoId: v === 'all' ? undefined : v }))}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Núcleo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os núcleos</SelectItem>
              {(nucleos.data ?? []).map((n) => (
                <SelectItem key={n.id} value={n.id}>{n.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={!temLinhas} onClick={baixarExcel}>
            <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" disabled={!temLinhas} onClick={baixarPdf}>
            <FileText className="mr-1 h-4 w-4" /> PDF
          </Button>
          {podeCriar && (
            <Button asChild>
              <Link to="/pedidos/novo"><Plus className="mr-1 h-4 w-4" /> Novo pedido</Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Central de pedidos</CardTitle></CardHeader>
        <CardContent>
          {pedidos.isLoading ? (
            <TableSkeleton />
          ) : (
            <div className="divide-y">
              {(pedidos.data ?? []).map((p) => (
                <Link key={p.id} to={`/pedidos/${p.id}`} className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-muted/40">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{p.codigo}</span>
                      <PedidoStatusBadge status={p.status} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.nucleo?.nome ?? '—'} · {resumoItens(p.itens ?? [])}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <p>{dataHora(p.created_at)}</p>
                    <p>{p.solicitante?.nome ?? '—'}</p>
                  </div>
                </Link>
              ))}
              {(pedidos.data ?? []).length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
