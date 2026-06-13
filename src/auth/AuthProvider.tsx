import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, UserStatus } from '@/data/types';
import { hasPermission, type Capability, type Role } from '@/auth/roles';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  isAdmin: boolean;
  /** Motivo do último bloqueio de login (conta não-ACTIVE), p/ a tela de login. */
  blockedStatus: Exclude<UserStatus, 'ACTIVE'> | null;
  can: (cap: Capability) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearBlocked: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [blockedStatus, setBlockedStatus] =
    useState<Exclude<UserStatus, 'ACTIVE'> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') {
        // HashRouter: navega para a redefinição via hash.
        window.location.hash = '#/redefinir-senha';
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Carrega o profile sempre que a sessão muda; bloqueia contas não-ACTIVE.
  // O guard `cancelled` evita setState/signOut tardios se a sessão mudar
  // enquanto o fetch do profile ainda está em voo.
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single()
      .then(async ({ data }) => {
        if (cancelled) return;
        const p = (data as Profile) ?? null;
        if (p && p.status !== 'ACTIVE') {
          setBlockedStatus(p.status);
          await supabase.auth.signOut();
          if (!cancelled) setProfile(null);
          return;
        }
        setProfile(p);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  const signIn = async (email: string, password: string) => {
    setBlockedStatus(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    setBlockedStatus(null);
    await supabase.auth.signOut();
  };

  const role = profile?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        role,
        loading,
        isAdmin: role === 'ADMIN',
        blockedStatus,
        can: (cap) => hasPermission(role, cap),
        signIn,
        signOut,
        clearBlocked: () => setBlockedStatus(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
