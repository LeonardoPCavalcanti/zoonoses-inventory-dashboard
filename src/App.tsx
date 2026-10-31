import { lazy, Suspense, type ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/auth/AuthProvider';
import ProtectedRoute from '@/auth/ProtectedRoute';
import type { Capability } from '@/auth/roles';
import AppShell from '@/components/layout/AppShell';
import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';
import Cadastrar from '@/pages/Cadastrar';
import AguardandoAprovacao from '@/pages/AguardandoAprovacao';
import EsqueciSenha from '@/pages/EsqueciSenha';
import RedefinirSenha from '@/pages/RedefinirSenha';
import AuthCallback from '@/pages/AuthCallback';

// Paginas internas carregam sob demanda: o bundle inicial fica com o login e
// o shell; graficos (recharts), PDF (pdf.js) e exportacoes (xlsx/jspdf) so
// descem quando a rota que os usa abre.
const Overview = lazy(() => import('@/pages/Overview'));
const Produtos = lazy(() => import('@/pages/Produtos'));
const Movimentacoes = lazy(() => import('@/pages/Movimentacoes'));
const Auditoria = lazy(() => import('@/pages/Auditoria'));
const Cadastros = lazy(() => import('@/pages/Cadastros'));
const Conta = lazy(() => import('@/pages/Conta'));
const UsuariosAdmin = lazy(() => import('@/pages/UsuariosAdmin'));
const Pedidos = lazy(() => import('@/pages/Pedidos'));
const NovoPedido = lazy(() => import('@/pages/NovoPedido'));
const PedidoDetalhe = lazy(() => import('@/pages/PedidoDetalhe'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

/** Envolve as páginas internas com guarda de rota + shell (sidebar/topbar). */
function Protected({ children, requireCapability }: { children: ReactNode; requireCapability?: Capability }) {
  return (
    <ProtectedRoute requireCapability={requireCapability}>
      <AppShell>
        <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando…</div>}>
          {children}
        </Suspense>
      </AppShell>
    </ProtectedRoute>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-right" richColors />
          <HashRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Protected><Overview /></Protected>} />
              <Route path="/produtos" element={<Protected><Produtos /></Protected>} />
              <Route path="/movimentacoes" element={<Protected><Movimentacoes /></Protected>} />
              <Route path="/auditoria" element={<Protected><Auditoria /></Protected>} />
              <Route path="/cadastros" element={<Protected><Cadastros /></Protected>} />
              <Route path="/cadastrar" element={<Cadastrar />} />
              <Route path="/aguardando-aprovacao" element={<AguardandoAprovacao />} />
              <Route path="/esqueci-senha" element={<EsqueciSenha />} />
              <Route path="/redefinir-senha" element={<RedefinirSenha />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/conta" element={<Protected><Conta /></Protected>} />
              <Route path="/admin/usuarios" element={<Protected requireCapability="manage_users"><UsuariosAdmin /></Protected>} />
              <Route path="/pedidos" element={<Protected><Pedidos /></Protected>} />
              <Route path="/pedidos/novo" element={<Protected><NovoPedido /></Protected>} />
              <Route path="/pedidos/:id" element={<Protected><PedidoDetalhe /></Protected>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </HashRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
