import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface AdminRedirectProps {
  children: React.ReactNode;
}

export function AdminRedirect({ children }: AdminRedirectProps) {
  const { isAdmin, user, loading, adminChecked } = useAuth();
  const location = useLocation();
  const hasRedirected = useRef(false);

  const isAdminRoute = location.pathname.startsWith('/admin');

  useEffect(() => {
    // Log para debug
    console.log('AdminRedirect state:', { 
      loading, 
      adminChecked, 
      isAdmin, 
      user: user?.email, 
      isAdminRoute,
      hasRedirected: hasRedirected.current 
    });

    // Só redireciona quando:
    // 1. Não está mais carregando
    // 2. A verificação de admin foi concluída
    // 3. O usuário é admin
    // 4. Não está em uma rota admin
    // 5. Não redirecionou ainda nesta sessão
    if (!loading && adminChecked && isAdmin && user && !isAdminRoute && !hasRedirected.current) {
      console.log('Admin detected on public route, redirecting to /admin');
      hasRedirected.current = true;
      // Forçar redirecionamento imediato
      window.location.replace('/admin');
    }
  }, [isAdmin, user, loading, adminChecked, isAdminRoute]);

  // Determinar se deve mostrar loading
  // 1. Está carregando a autenticação inicial
  // 2. Tem usuário logado mas ainda não verificou se é admin
  // 3. É admin em rota pública (está redirecionando)
  const isAuthLoading = loading;
  const isWaitingAdminCheck = user && !adminChecked;
  const isAdminOnPublicRoute = adminChecked && isAdmin && user && !isAdminRoute;

  const shouldShowLoading = isAuthLoading || isWaitingAdminCheck || isAdminOnPublicRoute;

  console.log('AdminRedirect render:', { 
    isAuthLoading, 
    isWaitingAdminCheck, 
    isAdminOnPublicRoute, 
    shouldShowLoading 
  });

  if (shouldShowLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
