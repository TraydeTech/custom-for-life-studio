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
    if (!loading && adminChecked && isAdmin && user && !isAdminRoute && !hasRedirected.current) {
      hasRedirected.current = true;
      window.location.replace('/admin');
    }
  }, [isAdmin, user, loading, adminChecked, isAdminRoute]);

  const shouldShowLoading = 
    loading || 
    (user && !adminChecked) || 
    (adminChecked && isAdmin && user && !isAdminRoute);

  if (shouldShowLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
