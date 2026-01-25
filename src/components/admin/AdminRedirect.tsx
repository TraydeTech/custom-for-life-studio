import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface AdminRedirectProps {
  children: React.ReactNode;
}

export function AdminRedirect({ children }: AdminRedirectProps) {
  const { isAdmin, user, loading, adminChecked } = useAuth();
  const location = useLocation();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const isAdminRoute = location.pathname.startsWith('/admin');

  useEffect(() => {
    // Só redireciona quando:
    // 1. Não está mais carregando
    // 2. A verificação de admin foi concluída
    // 3. O usuário é admin
    // 4. Não está em uma rota admin
    // 5. Não está já redirecionando
    if (!loading && adminChecked && isAdmin && user && !isAdminRoute && !isRedirecting) {
      console.log('Admin detected on public route, redirecting to /admin');
      setIsRedirecting(true);
      window.location.href = '/admin';
    }
  }, [isAdmin, user, loading, adminChecked, isAdminRoute, isRedirecting]);

  // Mostrar loading enquanto:
  // 1. Está carregando a autenticação
  // 2. Tem usuário mas ainda não verificou se é admin
  // 3. É admin em rota pública (redirecionando)
  const shouldShowLoading = 
    loading || 
    (user && !adminChecked) || 
    (isAdmin && user && !isAdminRoute) ||
    isRedirecting;

  if (shouldShowLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
