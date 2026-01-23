import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface AdminRedirectProps {
  children: React.ReactNode;
}

export function AdminRedirect({ children }: AdminRedirectProps) {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Redirecionar admin para o painel se não estiver em rotas de admin
    if (!loading && isAdmin && !location.pathname.startsWith('/admin')) {
      navigate('/admin', { replace: true });
    }
  }, [isAdmin, loading, location.pathname, navigate]);

  // Se for admin e não estiver em rota admin, mostrar loading enquanto redireciona
  if (!loading && isAdmin && !location.pathname.startsWith('/admin')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
