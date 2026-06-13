import { describe, it, expect } from 'vitest';
import { nextLoginStep, STATUS_MESSAGE } from './loginState';

describe('nextLoginStep', () => {
  it('bloqueia conta não-ACTIVE antes de qualquer MFA', () => {
    expect(nextLoginStep({ status: 'PENDING', currentLevel: 'aal1', nextLevel: 'aal1' }))
      .toEqual({ step: 'blocked', status: 'PENDING' });
  });
  it('pede MFA quando o próximo nível é aal2 e o atual é aal1', () => {
    expect(nextLoginStep({ status: 'ACTIVE', currentLevel: 'aal1', nextLevel: 'aal2' }))
      .toEqual({ step: 'mfa_challenge' });
  });
  it('conclui quando ativo e sem MFA pendente', () => {
    expect(nextLoginStep({ status: 'ACTIVE', currentLevel: 'aal1', nextLevel: 'aal1' }))
      .toEqual({ step: 'done' });
  });
  it('conclui quando já em aal2', () => {
    expect(nextLoginStep({ status: 'ACTIVE', currentLevel: 'aal2', nextLevel: 'aal2' }))
      .toEqual({ step: 'done' });
  });
});

describe('STATUS_MESSAGE', () => {
  it('tem mensagens específicas por status (rule #4)', () => {
    expect(STATUS_MESSAGE.PENDING).toMatch(/aguarda aprovação/i);
    expect(STATUS_MESSAGE.INACTIVE).toMatch(/desativada/i);
    expect(STATUS_MESSAGE.REJECTED).toMatch(/não aprovada/i);
  });
});
