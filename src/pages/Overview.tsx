import { Package, AlertTriangle, CalendarClock, ArrowLeftRight } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/shared/StatCard';
import { ErrorState, TableSkeleton } from '@/components/shared/states';
import { useEstoque } from '@/data/produtos';
import { useMovimentacoes } from '@/data/movimentacoes';
import { useSetores } from '@/data/cadastros';
import {
  calcularMetricas,
  diasAteValidade,
  estoquePorSetor,
  movimentacoesPorDia,
} from '@/data/dashboard';
import { useRealtime } from '@/hooks/useRealtime';
import { qk } from '@/lib/queryKeys';

export default function Overview() {
  const estoque = useEstoque();
  const movs = useMovimentacoes();
  const setores = useSetores();

  useRealtime([
    { table: 'movimentacoes', keys: [qk.movimentacoes, qk.estoque] },
    { table: 'lotes', keys: [qk.estoque] },
    { table: 'produtos', keys: [qk.estoque, qk.produtos] },
  ]);

  if (estoque.isError) return <ErrorState error={estoque.error} />;
  if (estoque.isLoading || movs.isLoading) return <TableSkeleton rows={6} />;

  const e = estoque.data ?? [];
  const m = movs.data ?? [];
  const metricas = calcularMetricas(e, m);
  const serieDias = movimentacoesPorDia(m, 7);
  const serieSetor = estoquePorSetor(e, setores.data ?? []);
  const baixos = e.filter((x) => x.estoque_baixo);
  const vencendo = e
    .map((x) => ({ ...x, dias: diasAteValidade(x.proxima_validade) }))
    .filter((x) => x.dias !== null && x.dias <= 30)
    .sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Produtos ativos" value={metricas.totalProdutos} icon={<Package className="h-5 w-5" />} />
        <StatCard
          label="Em estoque baixo"
          value={metricas.estoqueBaixo}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={metricas.estoqueBaixo > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label="Vencendo em ≤30 dias"
          value={metricas.vencendo30}
          icon={<CalendarClock className="h-5 w-5" />}
          tone={metricas.vencendo30 > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Movimentações hoje"
          value={metricas.movimentacoesHoje}
          icon={<ArrowLeftRight className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movimentações (7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={serieDias} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="dia" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="entradas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Entradas" />
                <Line type="monotone" dataKey="saidas" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} name="Saídas" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estoque por setor</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={serieSetor} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="setor" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estoque baixo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {baixos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item em estoque baixo.</p>}
            {baixos.map((x) => (
              <div key={x.produto_id} className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm font-medium">{x.nome}</span>
                <Badge variant="destructive">
                  {x.estoque_total} {x.unidade} (mín. {x.estoque_minimo})
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vencendo em breve</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {vencendo.length === 0 && <p className="text-sm text-muted-foreground">Nenhum lote vencendo em 30 dias.</p>}
            {vencendo.map((x) => (
              <div key={x.produto_id} className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm font-medium">{x.nome}</span>
                <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                  {x.dias! < 0 ? 'vencido' : `${x.dias} dias`}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
