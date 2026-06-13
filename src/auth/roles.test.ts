import { describe, it, expect } from 'vitest';
import {
  ROLE_RANK,
  hasPermission,
  canManage,
  assignableRoles,
  type Role,
} from './roles';

const ALL: Role[] = ['ADMIN', 'FINANCIAL_MANAGER', 'STOCKIST', 'NUCLEUS_SUPERVISOR', 'AUDITOR'];

describe('ROLE_RANK', () => {
  it('ordena ADMIN no topo e AUDITOR na base', () => {
    expect(ROLE_RANK.ADMIN).toBe(5);
    expect(ROLE_RANK.AUDITOR).toBe(1);
    expect(ROLE_RANK.ADMIN).toBeGreaterThan(ROLE_RANK.FINANCIAL_MANAGER);
  });
});

describe('canManage', () => {
  it('gerencia apenas quem tem rank estritamente menor', () => {
    expect(canManage('ADMIN', 'STOCKIST')).toBe(true);
    expect(canManage('FINANCIAL_MANAGER', 'ADMIN')).toBe(false);
  });
  it('nunca gerencia o mesmo nível', () => {
    for (const r of ALL) expect(canManage(r, r)).toBe(false);
  });
  it('um alvo sem role (PENDING) é gerenciável por qualquer role', () => {
    expect(canManage('AUDITOR', null)).toBe(true);
  });
  it('ator sem role não gerencia ninguém', () => {
    expect(canManage(null, 'AUDITOR')).toBe(false);
  });
});

describe('assignableRoles', () => {
  it('lista só papéis abaixo do ator', () => {
    expect(assignableRoles('FINANCIAL_MANAGER').sort()).toEqual(
      ['AUDITOR', 'NUCLEUS_SUPERVISOR', 'STOCKIST'].sort(),
    );
    expect(assignableRoles('AUDITOR')).toEqual([]);
  });
});

describe('hasPermission', () => {
  it('ADMIN pode gerenciar usuários; AUDITOR não', () => {
    expect(hasPermission('ADMIN', 'manage_users')).toBe(true);
    expect(hasPermission('AUDITOR', 'manage_users')).toBe(false);
  });
  it('AUDITOR vê auditoria e relatórios', () => {
    expect(hasPermission('AUDITOR', 'view_audit')).toBe(true);
    expect(hasPermission('AUDITOR', 'view_reports')).toBe(true);
  });
  it('STOCKIST gerencia estoque', () => {
    expect(hasPermission('STOCKIST', 'manage_stock')).toBe(true);
  });
  it('role nula não tem permissão alguma', () => {
    expect(hasPermission(null, 'view_reports')).toBe(false);
  });
});
