import { ReactNode, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const hasRedirected = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const checkAdminAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          if (isMounted && !hasRedirected.current) {
            hasRedirected.current = true;
            navigate('/admin/login', { replace: true });
          }
          return;
        }

        const { data: isAdmin, error } = await supabase.rpc('has_role', {
          _user_id: session.user.id,
          _role: 'admin'
        });

        if (error || !isAdmin) {
          await supabase.auth.signOut();
          if (isMounted && !hasRedirected.current) {
            hasRedirected.current = true;
            navigate('/admin/login', { replace: true });
          }
          return;
        }

        if (isMounted) {
          setIsAuthorized(true);
        }
      } catch {
        if (isMounted && !hasRedirected.current) {
          hasRedirected.current = true;
          navigate('/admin/login', { replace: true });
        }
      }
    };

    checkAdminAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && !hasRedirected.current) {
        hasRedirected.current = true;
        navigate('/admin/login', { replace: true });
      }
    });

    const timeout = setTimeout(() => {
      if (isMounted && isAuthorized === null && !hasRedirected.current) {
        hasRedirected.current = true;
        navigate('/admin/login', { replace: true });
      }
    }, 5000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
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
