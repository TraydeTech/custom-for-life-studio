import { ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const { user, isAdmin, loading, adminChecked } = useAuth();

  // Aviso amigável quando o usuário está logado mas não é admin.
  useEffect(() => {
    if (!loading && adminChecked && user && !isAdmin) {
      toast({
        title: 'Acesso restrito',
        description: 'Você não tem permissão para acessar o painel administrativo.',
        variant: 'destructive',
      });
    }
  }, [loading, adminChecked, user, isAdmin]);

  // Enquanto a sessão ou o papel admin estiverem carregando, NUNCA renderizar
  // o conteúdo administrativo. Sem timeout fixo — aguarda confirmação real.
  if (loading || !adminChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Não autenticado → login do admin
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Autenticado mas sem permissão → home
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
