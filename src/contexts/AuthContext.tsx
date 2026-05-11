import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { syncGuestCartToSupabase } from '@/hooks/useCart';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  adminChecked: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; isAdmin?: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  const checkIsAdmin = useCallback(async (userId: string): Promise<boolean> => {
    // Retry com backoff curto para resiliência de rede.
    // NUNCA retorna true em caso de erro — falhas mantêm acesso negado.
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: userId,
          _role: 'admin',
        });
        if (!error) return !!data;

        // Fallback: query direta na tabela user_roles
        const { data: roleData, error: queryError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();
        if (!queryError) return !!roleData;
      } catch {
        // continua para próxima tentativa
      }
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 250 * attempt));
      }
    }
    return false;
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Listener for ONGOING auth changes - does NOT control isLoading
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (event === 'SIGNED_OUT' || !newSession?.user) {
          setIsAdmin(false);
          setAdminChecked(true);
          return;
        }
        
        // Defer Supabase calls to avoid deadlock
        if (event === 'SIGNED_IN' && newSession?.user) {
          setTimeout(() => {
            if (!isMounted) return;
            checkIsAdmin(newSession.user.id).then(adminStatus => {
              if (isMounted) {
                setIsAdmin(adminStatus);
                setAdminChecked(true);
              }
            });
          }, 0);
        }
      }
    );

    // INITIAL load - controls isLoading
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        if (initialSession?.user) {
          const adminStatus = await Promise.race([
            checkIsAdmin(initialSession.user.id),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1500))
          ]);
          if (isMounted) {
            setIsAdmin(adminStatus);
            setAdminChecked(true);
          }
        } else {
          if (isMounted) {
            setIsAdmin(false);
            setAdminChecked(true);
          }
        }
      } catch {
        if (isMounted) {
          setIsAdmin(false);
          setAdminChecked(true);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return { error, isAdmin: false };
    }
    
    if (data.user) {
      const adminStatus = await checkIsAdmin(data.user.id);
      setIsAdmin(adminStatus);
      setAdminChecked(true);
      // Mover carrinho de visitante para o banco após login
      syncGuestCartToSupabase(data.user.id).catch(() => {});
      return { error: null, isAdmin: adminStatus };
    }
    
    return { error: null, isAdmin: false };
  };

  const signOut = async () => {
    setIsAdmin(false);
    setAdminChecked(false);
    setUser(null);
    setSession(null);
    await supabase.auth.signOut({ scope: 'global' });
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      isAdmin, 
      adminChecked,
      signUp, 
      signIn, 
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
