/** Constrói a URL de retorno dos e-mails do Supabase, robusta ao subpath. */
export function buildRedirect(origin: string, base: string): string {
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${origin}${cleanBase}/#/auth/callback`;
}

/** Conveniência para o runtime do browser. */
export function authRedirectUrl(): string {
  return buildRedirect(window.location.origin, import.meta.env.BASE_URL);
}
