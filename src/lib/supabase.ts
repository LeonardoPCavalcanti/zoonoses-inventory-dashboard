import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true quando as variáveis do Supabase estão configuradas. */
export const supabaseConfigured = Boolean(url && anon);

if (!supabaseConfigured) {
  // Falha clara em dev/preview sem env — a UI mostra um aviso amigável.
  console.warn(
    '[Supabase] Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (.env). ' +
      'A anon key é pública por design; o RLS protege os dados.',
  );
}

export const supabase = createClient(url ?? 'http://localhost', anon ?? 'public-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce' },
});
