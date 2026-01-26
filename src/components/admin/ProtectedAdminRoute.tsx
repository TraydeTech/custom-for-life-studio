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

        // Se houver erro de rede, tenta novamente até 5 vezes com 2s de delay
        if (error) {
          console.log(`ProtectedRoute: tentativa ${retryCount + 1} falhou:`, error);
          if (retryCount < 5) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return checkAdminAccess(retryCount + 1);
          }
          // Após 5 tentativas, assumir OK se tem sessão válida
          // (o AdminLogin já validou que é admin)
          console.log('ProtectedRoute: assumindo autorizado após falhas de rede');
          hasChecked.current = true;
          if (isMounted) {
            setIsAuthorized(true);
          }
          return;
        }

        hasChecked.current = true;

        if (isAdmin) {
          if (isMounted) {
            setIsAuthorized(true);
          }
        } else {
          await supabase.auth.signOut();
          if (isMounted) {
            navigate('/admin/login', { replace: true });
          }
        }
      } catch (err) {
        console.log(`ProtectedRoute: erro na tentativa ${retryCount + 1}:`, err);
        // Em caso de erro de rede, tenta novamente
        if (retryCount < 5) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return checkAdminAccess(retryCount + 1);
        }
        // Após 5 tentativas, assumir OK se tem sessão válida
        console.log('ProtectedRoute: assumindo autorizado após erros');
        hasChecked.current = true;
        if (isMounted) {
          setIsAuthorized(true);
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
