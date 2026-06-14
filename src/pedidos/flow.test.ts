// src/pedidos/flow.test.ts
import { describe, it, expect } from 'vitest';
import {
  STATUS_LABEL, statusVariant, resumoItens,
  canDespachar, canConfirmarRemetente, canConfirmarDestinatario, canAnalisar,
} from './flow';

describe('STATUS_LABEL', () => {
  it('cobre todos os status com rótulo PT-BR', () => {
    expect(STATUS_LABEL.AGUARDANDO_ANALISE).toBe('Aguardando análise');
    expect(STATUS_LABEL.CONCLUIDO_PARCIAL).toBe('Concluído (parcial)');
  });
});

describe('resumoItens', () => {
  it('mostra os 3 primeiros e "e mais N"', () => {
    const itens = [
      { produto: { nome: 'Vacina' } }, { produto: { nome: 'Soro' } },
      { produto: { nome: 'Luva' } }, { produto: { nome: 'Seringa' } },
    ] as never[];
    expect(resumoItens(itens)).toBe('Vacina, Soro, Luva e mais 1 item');
  });
  it('sem "e mais" quando há 3 ou menos', () => {
    const itens = [{ produto: { nome: 'Vacina' } }] as never[];
    expect(resumoItens(itens)).toBe('Vacina');
  });
});

describe('gates de ação por papel × status', () => {
  it('estoquista despacha só APROVADO', () => {
    expect(canDespachar('STOCKIST', 'APROVADO')).toBe(true);
    expect(canDespachar('STOCKIST', 'ENVIADO')).toBe(false);
    expect(canDespachar('NUCLEUS_SUPERVISOR', 'APROVADO')).toBe(false);
  });
  it('remetente confirma só em ENVIADO e se ainda não confirmou', () => {
    expect(canConfirmarRemetente('STOCKIST', 'ENVIADO', false)).toBe(true);
    expect(canConfirmarRemetente('STOCKIST', 'ENVIADO', true)).toBe(false);
  });
  it('destinatário confirma só se for dono do núcleo, em ENVIADO', () => {
    expect(canConfirmarDestinatario('NUCLEUS_SUPERVISOR', 'ENVIADO', true, false)).toBe(true);
    expect(canConfirmarDestinatario('NUCLEUS_SUPERVISOR', 'ENVIADO', false, false)).toBe(false);
  });
  it('analista (admin/financeiro) analisa só AGUARDANDO_ANALISE', () => {
    expect(canAnalisar('ADMIN', 'AGUARDANDO_ANALISE')).toBe(true);
    expect(canAnalisar('FINANCIAL_MANAGER', 'AGUARDANDO_ANALISE')).toBe(true);
    expect(canAnalisar('STOCKIST', 'AGUARDANDO_ANALISE')).toBe(false);
    expect(canAnalisar('ADMIN', 'APROVADO')).toBe(false);
  });
});
