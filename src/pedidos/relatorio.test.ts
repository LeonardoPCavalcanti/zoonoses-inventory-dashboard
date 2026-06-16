import { describe, expect, it } from 'vitest';
import {
  COLUNAS_RELATORIO, pedidoParaLinha, montarLinhas,
  nomeArquivoRelatorio, isAtrasado, DIAS_ATRASO,
} from './relatorio';
import type { Pedido } from '@/data/types';

const base: Pedido = {
  id: 'p1', codigo: 'PED-2026-0001', status: 'AGUARDANDO_ANALISE',
  justificativa: 'Reposição', nucleo_id: 'n1', solicitante_id: 's1',
  analista_id: null, analisado_em: null, devolvido_em: null,
  enviado_por: null, enviado_em: null,
  entrega_remetente_por: null, entrega_remetente_em: null,
  entrega_destinatario_por: null, entrega_destinatario_em: null,
  created_at: '2026-06-01T12:00:00.000Z', updated_at: '2026-06-01T12:00:00.000Z',
  nucleo: { id: 'n1', nome: 'Núcleo Centro', codigo: 'NC' },
  solicitante: { id: 's1', nome: 'Maria' },
  itens: [
    { id: 'i1', pedido_id: 'p1', produto_id: 'pr1', qtd_solicitada: 10, qtd_aprovada: null, qtd_recebida: null, produto: { id: 'pr1', nome: 'Vacina', unidade: 'un' } },
    { id: 'i2', pedido_id: 'p1', produto_id: 'pr2', qtd_solicitada: 5, qtd_aprovada: null, qtd_recebida: null, produto: { id: 'pr2', nome: 'Soro', unidade: 'fr' } },
  ],
};

describe('relatorio', () => {
  it('expõe um cabeçalho estável com 6 colunas', () => {
    expect(COLUNAS_RELATORIO).toEqual(['Código', 'Status', 'Núcleo', 'Solicitante', 'Itens', 'Criado em']);
  });

  it('converte um pedido em linha com status legível e contagem de itens', () => {
    const linha = pedidoParaLinha(base);
    expect(linha[0]).toBe('PED-2026-0001');
    expect(linha[1]).toBe('Aguardando análise');
    expect(linha[2]).toBe('Núcleo Centro');
    expect(linha[3]).toBe('Maria');
    expect(linha[4]).toBe('2 itens');
    expect(linha[5]).toMatch(/2026/);
  });

  it('usa travessão para joins ausentes e singular para 1 item', () => {
    const linha = pedidoParaLinha({ ...base, nucleo: null, solicitante: null, itens: [base.itens![0]] });
    expect(linha[2]).toBe('—');
    expect(linha[3]).toBe('—');
    expect(linha[4]).toBe('1 item');
  });

  it('monta a matriz completa preservando a ordem recebida', () => {
    const linhas = montarLinhas([base, { ...base, id: 'p2', codigo: 'PED-2026-0002' }]);
    expect(linhas).toHaveLength(2);
    expect(linhas[0][0]).toBe('PED-2026-0001');
    expect(linhas[1][0]).toBe('PED-2026-0002');
  });

  it('gera nome de arquivo com a data de hoje e a extensão pedida', () => {
    expect(nomeArquivoRelatorio('xlsx', new Date('2026-06-16T10:00:00Z'))).toBe('pedidos-2026-06-16.xlsx');
    expect(nomeArquivoRelatorio('pdf', new Date('2026-06-16T10:00:00Z'))).toBe('pedidos-2026-06-16.pdf');
  });

  it('marca como atrasado só AGUARDANDO_ANALISE além do limite', () => {
    const agora = new Date('2026-06-16T12:00:00.000Z');
    expect(DIAS_ATRASO).toBe(5);
    const velho = '2026-06-10T12:00:00.000Z'; // 6 dias
    const novo = '2026-06-14T12:00:00.000Z';  // 2 dias
    expect(isAtrasado({ status: 'AGUARDANDO_ANALISE', created_at: velho }, agora)).toBe(true);
    expect(isAtrasado({ status: 'AGUARDANDO_ANALISE', created_at: novo }, agora)).toBe(false);
    expect(isAtrasado({ status: 'APROVADO', created_at: velho }, agora)).toBe(false);
  });
});
