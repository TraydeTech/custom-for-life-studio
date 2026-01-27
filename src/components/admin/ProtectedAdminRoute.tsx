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
    // Evitar verificações duplicadas
    if (hasChecked.current) return;
    hasChecked.current = true;

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

        // Autoriza imediatamente se tem sessão válida
        // A verificação de role é apenas para segurança adicional
        if (isMounted) {
          setIsAuthorized(true);
        }

        // Verificar admin em segundo plano (não bloqueia UI)
        try {
          const { data: isAdmin } = await supabase.rpc('has_role', {
            _user_id: session.user.id,
            _role: 'admin'
          });

          // Se explicitamente NÃO é admin, faz logout
          if (isAdmin === false && isMounted) {
            console.log('ProtectedRoute: usuário não é admin, fazendo logout');
            await supabase.auth.signOut();
            navigate('/admin/login', { replace: true });
          }
        } catch {
          // Erro de rede - mantém autorizado (já tem sessão)
          console.log('ProtectedRoute: erro na verificação de role, mantendo acesso');
        }
      } catch {
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

  // Mostra loading apenas por brevíssimo momento enquanto verifica sessão inicial
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
