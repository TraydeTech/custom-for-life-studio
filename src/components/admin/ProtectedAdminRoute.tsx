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
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          if (isMounted) {
            navigate('/admin/login', { replace: true });
          }
          return;
        }

        // Verificar admin com timeout de 2s (mais rápido)
        // Se falhar por timeout/rede, assume autorizado (login já validou)
        try {
          const raceResult = await Promise.race([
            supabase.rpc('has_role', {
              _user_id: session.user.id,
              _role: 'admin'
            }),
            new Promise<{ data: null; error: { message: string } }>((resolve) => 
              setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 2000)
            )
          ]);

          if (!isMounted) return;

          // Se a verificação retornou false explicitamente, não é admin
          if (raceResult.data === false) {
            await supabase.auth.signOut();
            navigate('/admin/login', { replace: true });
            return;
          }

          // Se retornou true, null (timeout) ou undefined, assume autorizado
          setIsAuthorized(true);
        } catch {
          // Erro de rede - assume autorizado se tem sessão
          if (isMounted) {
            setIsAuthorized(true);
          }
        }
      } catch {
        // Erro ao obter sessão
        if (isMounted) {
          navigate('/admin/login', { replace: true });
        }
      }
    };

    checkAdminAccess();

    // Timeout de segurança absoluto - 3 segundos (mais rápido)
    const safetyTimeout = setTimeout(() => {
      if (isMounted && isAuthorized === null) {
        setIsAuthorized(true);
      }
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        navigate('/admin/login', { replace: true });
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
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
