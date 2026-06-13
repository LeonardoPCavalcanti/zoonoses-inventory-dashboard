import { describe, it, expect } from 'vitest';
import { buildRedirect } from './redirect';

describe('buildRedirect', () => {
  it('junta origin + base + rota de callback sem barras duplicadas', () => {
    expect(buildRedirect('https://x.github.io', '/zoonoses-inventory-dashboard/'))
      .toBe('https://x.github.io/zoonoses-inventory-dashboard/#/auth/callback');
  });
  it('lida com base "/" (dev)', () => {
    expect(buildRedirect('http://localhost:8080', '/'))
      .toBe('http://localhost:8080/#/auth/callback');
  });
});
