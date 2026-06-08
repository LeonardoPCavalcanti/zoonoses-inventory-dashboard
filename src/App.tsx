import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/auth/AuthProvider';
import ProtectedRoute from '@/auth/ProtectedRoute';
import AppShell from '@/components/layout/AppShell';
import Login from '@/pages/Login';
import Overview from '@/pages/Overview';
import Produtos from '@/pages/Produtos';
import Movimentacoes from '@/pages/Movimentacoes';
import Auditoria from '@/pages/Auditoria';
import Cadastros from '@/pages/Cadastros';
import NotFound from '@/pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

/** Envolve as páginas internas com guarda de rota + shell (sidebar/topbar). */
function Protected({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </HashRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
