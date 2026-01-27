import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
    try {
      // Tentar via RPC primeiro (mais confiável com SECURITY DEFINER)
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin'
      });
      
      if (!error) {
        return !!data;
      }
      
      // Fallback: query direta
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      return !!roleData;
    } catch {
      // Erros de abort são esperados durante navegação
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        if (initialSession?.user) {
          // Usar Promise.race com timeout curto para não travar a UI
          const adminCheck = Promise.race([
            checkIsAdmin(initialSession.user.id),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1500))
          ]);
          
          const adminStatus = await adminCheck;
          if (isMounted) {
            setIsAdmin(adminStatus);
            setAdminChecked(true);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setIsAdmin(false);
            setAdminChecked(true);
            setLoading(false);
          }
        }
      } catch {
        if (isMounted) {
          setLoading(false);
          setAdminChecked(true);
        }
      }
    };

    // Subscrição para mudanças de auth (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return;
        
        // Atualizar sessão imediatamente
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        // Se é um evento de logout, limpar estado imediatamente
        if (event === 'SIGNED_OUT' || !newSession?.user) {
          setIsAdmin(false);
          setAdminChecked(true);
          setLoading(false);
          return;
        }
        
        // Se é login, verificar admin rapidamente
        if (event === 'SIGNED_IN' && newSession?.user) {
          const adminCheck = Promise.race([
            checkIsAdmin(newSession.user.id),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1500))
          ]);
          
          const adminStatus = await adminCheck;
          if (isMounted) {
            setIsAdmin(adminStatus);
            setAdminChecked(true);
            setLoading(false);
          }
        }
      }
    );

    initializeAuth();

    // Timeout de segurança mais agressivo - 2 segundos
    const safetyTimeout = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false);
        setAdminChecked(true);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [checkIsAdmin, loading]);

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
      return { error: null, isAdmin: adminStatus };
    }
    
    return { error: null, isAdmin: false };
  };

  const signOut = async () => {
    // Limpar estado local primeiro
    setIsAdmin(false);
    setAdminChecked(false);
    setUser(null);
    setSession(null);
    
    // Forçar limpeza do localStorage
    try {
      localStorage.removeItem('sb-ihkbxdayhdewqzezdrfl-auth-token');
      sessionStorage.clear();
    } catch (e) {
      console.error('Error clearing storage:', e);
    }
    
    // Fazer signOut no Supabase
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
