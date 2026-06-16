import type { Pedido, PedidoStatus } from '@/data/types';
import { STATUS_LABEL } from './flow';

export const COLUNAS_RELATORIO = ['Código', 'Status', 'Núcleo', 'Solicitante', 'Itens', 'Criado em'] as const;

export const DIAS_ATRASO = 5;

function dataLegivel(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function contagemItens(pedido: Pedido): string {
  const n = pedido.itens?.length ?? 0;
  return `${n} ${n === 1 ? 'item' : 'itens'}`;
}

/** Uma linha (array de strings) pronta para Excel/PDF. */
export function pedidoParaLinha(pedido: Pedido): string[] {
  return [
    pedido.codigo,
    STATUS_LABEL[pedido.status],
    pedido.nucleo?.nome ?? '—',
    pedido.solicitante?.nome ?? '—',
    contagemItens(pedido),
    dataLegivel(pedido.created_at),
  ];
}

export function montarLinhas(pedidos: Pedido[]): string[][] {
  return pedidos.map(pedidoParaLinha);
}

export function nomeArquivoRelatorio(ext: 'xlsx' | 'pdf', agora = new Date()): string {
  const dia = agora.toISOString().slice(0, 10); // YYYY-MM-DD
  return `pedidos-${dia}.${ext}`;
}

/** True só para pedidos ainda em análise além do limite de dias. */
export function isAtrasado(
  pedido: Pick<Pedido, 'status' | 'created_at'> & { status: PedidoStatus },
  agora = new Date(),
): boolean {
  if (pedido.status !== 'AGUARDANDO_ANALISE') return false;
  const limite = agora.getTime() - DIAS_ATRASO * 24 * 60 * 60 * 1000;
  return new Date(pedido.created_at).getTime() < limite;
}
