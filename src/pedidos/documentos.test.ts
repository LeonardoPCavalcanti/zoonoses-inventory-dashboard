import { describe, expect, it } from 'vitest';
import { storagePath, blocoAval, canAssinar } from './documentos';

describe('documentos helpers', () => {
  it('builds an original storage path under the pedido id', () => {
    expect(storagePath('abc', 'original', 'laudo.pdf')).toBe('pedidos/abc/original/laudo.pdf');
  });
  it('sanitizes spaces/accents in filenames', () => {
    expect(storagePath('abc', 'original', 'Ofício Núcleo.pdf')).toBe('pedidos/abc/original/oficio-nucleo.pdf');
  });
  it('composes the approval block text', () => {
    const txt = blocoAval({ nome: 'Maria', cargo: 'Administrador', quando: '2026-06-15T12:00:00Z', hash: 'deadbeef' });
    expect(txt).toContain('Aprovado por: Maria');
    expect(txt).toContain('Cargo: Administrador');
    expect(txt).toContain('Hash de verificação: deadbeef');
    expect(txt).toContain('Plataforma Zoonoses');
  });
  it('only ADMIN/FINANCIAL_MANAGER can sign an order awaiting analysis', () => {
    expect(canAssinar('ADMIN', 'AGUARDANDO_ANALISE')).toBe(true);
    expect(canAssinar('FINANCIAL_MANAGER', 'AGUARDANDO_ANALISE')).toBe(true);
    expect(canAssinar('STOCKIST', 'AGUARDANDO_ANALISE')).toBe(false);
    expect(canAssinar('ADMIN', 'APROVADO')).toBe(false);
    expect(canAssinar(null, 'AGUARDANDO_ANALISE')).toBe(false);
  });
});
