/** Constrói a URL de retorno dos e-mails do Supabase, robusta ao subpath. */
export function buildRedirect(origin: string, base: string): string {
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${origin}${cleanBase}/#/auth/callback`;
}

/**
 * URL de retorno para o runtime do browser. Os argumentos têm default para o
 * ambiente real, mas podem ser injetados em teste.
 */
export function authRedirectUrl(
  origin: string = window.location.origin,
  base: string = import.meta.env.BASE_URL,
): string {
  return buildRedirect(origin, base);
}
