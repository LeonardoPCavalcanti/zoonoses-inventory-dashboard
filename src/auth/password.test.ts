import { describe, it, expect } from 'vitest';
import { validatePassword } from './password';

describe('validatePassword', () => {
  it('aceita senha com 8+ chars, letra e número', () => {
    expect(validatePassword('abc12345')).toEqual({ ok: true, errors: [] });
  });
  it('rejeita menos de 8 caracteres', () => {
    const r = validatePassword('ab12');
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('Mínimo de 8 caracteres.');
  });
  it('rejeita sem número', () => {
    const r = validatePassword('abcdefgh');
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('Inclua ao menos um número.');
  });
  it('rejeita sem letra', () => {
    const r = validatePassword('12345678');
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('Inclua ao menos uma letra.');
  });
});
