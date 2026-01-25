import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface AdminRedirectProps {
  children: React.ReactNode;
}

export function AdminRedirect({ children }: AdminRedirectProps) {
  const { isAdmin, user, loading } = useAuth();
  const location = useLocation();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  const isAdminRoute = location.pathname.startsWith('/admin');

  useEffect(() => {
    // Quando terminar de carregar e for admin em página não-admin, redirecionar
    if (!loading && isAdmin && user && !isAdminRoute) {
      setShouldRedirect(true);
      // Usar window.location para garantir reload completo
      window.location.href = '/admin';
    }
  }, [isAdmin, user, loading, isAdminRoute]);

  // Mostrar loading enquanto verifica autenticação (máximo 3 segundos)
  // ou enquanto está redirecionando admin
  if (loading || shouldRedirect || (isAdmin && user && !isAdminRoute)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
