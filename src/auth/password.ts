export interface PasswordCheck {
  ok: boolean;
  errors: string[];
}

/** Política mínima (rule #7 do spec): 8+ caracteres, com letra e número. */
export function validatePassword(pwd: string): PasswordCheck {
  const errors: string[] = [];
  if (pwd.length < 8) errors.push('Mínimo de 8 caracteres.');
  if (!/[a-zA-Z]/.test(pwd)) errors.push('Inclua ao menos uma letra.');
  if (!/[0-9]/.test(pwd)) errors.push('Inclua ao menos um número.');
  return { ok: errors.length === 0, errors };
}
