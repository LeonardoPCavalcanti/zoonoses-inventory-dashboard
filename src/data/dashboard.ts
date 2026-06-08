import type { EstoqueProduto, Movimentacao } from './types';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Dias até a validade (negativo = vencido); null se sem validade. */
export function diasAteValidade(validade: string | null): number | null {
  if (!validade) return null;
  const alvo = new Date(validade + 'T00:00:00').getTime();
  return Math.ceil((alvo - Date.now()) / DIA_MS);
}

export interface MetricasDashboard {
  totalProdutos: number;
  estoqueBaixo: number;
  vencendo30: number;
  movimentacoesHoje: number;
}

/** Cards da visão geral, derivados do estoque e das movimentações. */
export function calcularMetricas(
  estoque: EstoqueProduto[],
  movimentacoes: Movimentacao[],
): MetricasDashboard {
  const hoje = new Date().toDateString();
  return {
    totalProdutos: estoque.filter((e) => e.ativo).length,
    estoqueBaixo: estoque.filter((e) => e.estoque_baixo).length,
    vencendo30: estoque.filter((e) => {
      const d = diasAteValidade(e.proxima_validade);
      return d !== null && d <= 30;
    }).length,
    movimentacoesHoje: movimentacoes.filter(
      (m) => new Date(m.created_at).toDateString() === hoje,
    ).length,
  };
}

/** Série "movimentações por dia" (últimos `dias` dias) para o gráfico. */
export function movimentacoesPorDia(
  movimentacoes: Movimentacao[],
  dias = 7,
): { dia: string; entradas: number; saidas: number }[] {
  const buckets = new Map<string, { entradas: number; saidas: number }>();
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DIA_MS);
    buckets.set(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), {
      entradas: 0,
      saidas: 0,
    });
  }
  for (const m of movimentacoes) {
    const label = new Date(m.created_at).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    const b = buckets.get(label);
    if (!b) continue;
    if (m.tipo === 'entrada') b.entradas += m.quantidade;
    else if (m.tipo === 'saida') b.saidas += m.quantidade;
  }
  return [...buckets.entries()].map(([dia, v]) => ({ dia, ...v }));
}

/** Estoque total agrupado por setor (gráfico de barras). */
export function estoquePorSetor(
  estoque: EstoqueProduto[],
  setores: { id: string; nome: string }[],
): { setor: string; total: number }[] {
  const nome = new Map(setores.map((s) => [s.id, s.nome]));
  const acc = new Map<string, number>();
  for (const e of estoque) {
    const label = (e.setor_id && nome.get(e.setor_id)) || 'Sem setor';
    acc.set(label, (acc.get(label) ?? 0) + e.estoque_total);
  }
  return [...acc.entries()].map(([setor, total]) => ({ setor, total }));
}
