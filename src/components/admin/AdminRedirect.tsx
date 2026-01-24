import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface AdminRedirectProps {
  children: React.ReactNode;
}

export function AdminRedirect({ children }: AdminRedirectProps) {
  const { isAdmin, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showContent, setShowContent] = useState(false);

  const isAdminRoute = location.pathname.startsWith('/admin');

  // Timeout de segurança - mostra conteúdo após 3 segundos mesmo se ainda loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!showContent) {
        setShowContent(true);
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, []);

  // Atualiza showContent quando loading terminar
  useEffect(() => {
    if (!loading) {
      setShowContent(true);
    }
  }, [loading]);

  useEffect(() => {
    // Quando terminar de carregar e for admin em página não-admin
    if (!loading && isAdmin && user && !isAdminRoute) {
      navigate('/admin', { replace: true });
    }
  }, [isAdmin, user, loading, isAdminRoute, navigate]);

  // Mostrar loading enquanto verifica autenticação (máximo 3 segundos)
  if (loading && !showContent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se for admin e não estiver em rota admin, mostrar loading enquanto redireciona
  if (isAdmin && user && !isAdminRoute && !showContent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
