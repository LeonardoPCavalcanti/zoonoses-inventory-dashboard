import { describe, it, expect } from 'vitest';
import { canApprove, canChangeRole, canChangeStatus } from './userActions';

describe('canApprove', () => {
  it('só ADMIN aprova', () => {
    expect(canApprove('ADMIN')).toBe(true);
    expect(canApprove('FINANCIAL_MANAGER')).toBe(false);
    expect(canApprove(null)).toBe(false);
  });
});

describe('canChangeRole', () => {
  it('ADMIN muda papel de alguém abaixo para outro abaixo', () => {
    expect(canChangeRole('ADMIN', 'STOCKIST', 'AUDITOR', false).ok).toBe(true);
  });
  it('não pode atribuir papel >= ao seu', () => {
    expect(canChangeRole('ADMIN', 'STOCKIST', 'ADMIN', false).ok).toBe(false);
  });
  it('não pode gerenciar alvo de papel igual/superior', () => {
    expect(canChangeRole('ADMIN', 'ADMIN', 'AUDITOR', false).ok).toBe(false);
  });
  it('não pode mudar o próprio papel', () => {
    expect(canChangeRole('ADMIN', 'STOCKIST', 'AUDITOR', true).ok).toBe(false);
  });
  it('não-ADMIN não muda papel', () => {
    expect(canChangeRole('FINANCIAL_MANAGER', 'STOCKIST', 'AUDITOR', false).ok).toBe(false);
  });
});

describe('canChangeStatus', () => {
  it('ADMIN desativa estoquista', () => {
    expect(canChangeStatus('ADMIN', 'STOCKIST', 'INACTIVE', { isSelf: false, isLastActiveAdmin: false }).ok).toBe(true);
  });
  it('bloqueia desativar o último admin ativo', () => {
    expect(canChangeStatus('ADMIN', 'ADMIN', 'INACTIVE', { isSelf: false, isLastActiveAdmin: true }).ok).toBe(false);
  });
  it('não pode mudar o próprio status', () => {
    expect(canChangeStatus('ADMIN', 'STOCKIST', 'INACTIVE', { isSelf: true, isLastActiveAdmin: false }).ok).toBe(false);
  });
});
