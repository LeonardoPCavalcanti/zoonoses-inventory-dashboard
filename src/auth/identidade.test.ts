import { describe, expect, it } from 'vitest';
import { soDigitos, validarCpf, formatarCpf, validarTelefoneBR, formatarTelefone } from './identidade';

describe('identidade', () => {
  it('soDigitos remove tudo que não é dígito', () => {
    expect(soDigitos('(81) 99876-5432')).toBe('81998765432');
    expect(soDigitos('529.982.247-25')).toBe('52998224725');
  });

  it('validarCpf aceita CPF válido e rejeita inválido/sequência', () => {
    expect(validarCpf('529.982.247-25')).toBe(true);
    expect(validarCpf('52998224725')).toBe(true);
    expect(validarCpf('111.111.111-11')).toBe(false);
    expect(validarCpf('529.982.247-26')).toBe(false);
    expect(validarCpf('123')).toBe(false);
  });

  it('formatarCpf aplica a máscara', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
  });

  it('validarTelefoneBR aceita celular (11) e fixo (10), rejeita o resto', () => {
    expect(validarTelefoneBR('81998765432')).toBe(true);
    expect(validarTelefoneBR('8133221122')).toBe(true);
    expect(validarTelefoneBR('8199876543')).toBe(false); // 10 díg começando com 9 → inválido
    expect(validarTelefoneBR('123')).toBe(false);
  });

  it('formatarTelefone aplica máscara de celular e fixo', () => {
    expect(formatarTelefone('81998765432')).toBe('(81) 99876-5432');
    expect(formatarTelefone('8133221122')).toBe('(81) 3322-1122');
  });
});
