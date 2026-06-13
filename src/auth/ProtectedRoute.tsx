import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import type { Capability } from './roles';

/** Bloqueia rotas sem sessão; opcionalmente exige uma capacidade. */
export default function ProtectedRoute({
  children,
  requireCapability,
}: {
  children: ReactNode;
  requireCapability?: Capability;
}) {
  const { session, loading, can } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (requireCapability && !can(requireCapability)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
