import { ReactNode, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const hasChecked = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const checkAdminAccess = async (retryCount = 0): Promise<void> => {
      // Evita verificação duplicada
      if (hasChecked.current) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          hasChecked.current = true;
          if (isMounted) {
            navigate('/admin/login', { replace: true });
          }
          return;
        }

        const { data: isAdmin, error } = await supabase.rpc('has_role', {
          _user_id: session.user.id,
          _role: 'admin'
        });

        // Se houver erro de rede, tenta novamente até 3 vezes
        if (error) {
          if (retryCount < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return checkAdminAccess(retryCount + 1);
          }
          // Após 3 tentativas, assume erro e redireciona
          hasChecked.current = true;
          if (isMounted) {
            navigate('/admin/login', { replace: true });
          }
          return;
        }

        hasChecked.current = true;

        if (!isAdmin) {
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
        // Em caso de erro de rede, tenta novamente
        if (retryCount < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return checkAdminAccess(retryCount + 1);
        }
        hasChecked.current = true;
        if (isMounted) {
          navigate('/admin/login', { replace: true });
        }
      }
    };

    checkAdminAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        navigate('/admin/login', { replace: true });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

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
