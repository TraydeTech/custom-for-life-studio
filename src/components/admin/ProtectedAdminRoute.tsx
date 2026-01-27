import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const { user, isAdmin, loading, adminChecked } = useAuth();

  // Mostrar loading enquanto verifica autenticação
  // Mas com timeout máximo de 2 segundos integrado no AuthContext
  if (loading || !adminChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se não tem usuário, redirecionar para login
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Se não é admin, redirecionar para login
  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
