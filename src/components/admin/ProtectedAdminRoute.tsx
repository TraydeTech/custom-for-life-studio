import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkAdminAccess = async () => {
      try {
        // Verificar sessão atual
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          if (isMounted) {
            navigate('/admin/login', { replace: true });
          }
          return;
        }

        // Verificar se é admin usando RPC
        const { data: isAdmin, error } = await supabase.rpc('has_role', {
          _user_id: session.user.id,
          _role: 'admin'
        });

        if (error || !isAdmin) {
          // Não é admin, fazer logout e redirecionar
          await supabase.auth.signOut();
          if (isMounted) {
            navigate('/admin/login', { replace: true });
          }
          return;
        }

        if (isMounted) {
          setIsAuthorized(true);
        }
      } catch {
        if (isMounted) {
          navigate('/admin/login', { replace: true });
        }
      }
    };

    checkAdminAccess();

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        navigate('/admin/login', { replace: true });
      }
    });

    // Safety timeout para evitar loading infinito
    const timeout = setTimeout(() => {
      if (isMounted && isAuthorized === null) {
        navigate('/admin/login', { replace: true });
      }
    }, 5000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate, isAuthorized]);

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
