export function soDigitos(v: string): string {
  return (v ?? '').replace(/\D/g, '');
}

/** CPF: 11 dígitos, não-sequência, com os 2 dígitos verificadores corretos. */
export function validarCpf(cpf: string): boolean {
  const d = soDigitos(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const dig = (fim: number) => {
    let s = 0;
    for (let i = 0; i < fim; i++) s += Number(d[i]) * (fim + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(d[9]) && dig(10) === Number(d[10]);
}

export function formatarCpf(cpf: string): string {
  const d = soDigitos(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Telefone BR: celular 11 díg (DDD + 9 + 8) ou fixo 10 díg (DDD + [2-5] + 7). */
export function validarTelefoneBR(tel: string): boolean {
  return /^[1-9][0-9](9[0-9]{8}|[2-5][0-9]{7})$/.test(soDigitos(tel));
}

export function formatarTelefone(tel: string): string {
  const d = soDigitos(tel);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}
