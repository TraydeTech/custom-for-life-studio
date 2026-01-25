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

  // Usar a função has_role do banco de dados (SECURITY DEFINER) para verificar admin
  const checkIsAdmin = useCallback(async (userId: string): Promise<boolean> => {
    try {
      console.log('Checking admin status for user:', userId);
      
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin'
      });
      
      if (error) {
        console.error('Error checking admin role via RPC:', error);
        // Fallback: tentar query direta
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();
        
        if (roleError) {
          console.error('Fallback query also failed:', roleError);
          return false;
        }
        
        console.log('Admin status via fallback:', !!roleData);
        return !!roleData;
      }
      
      console.log('Admin status via RPC:', data);
      return !!data;
    } catch (error) {
      console.error('Error checking admin role:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        console.log('Initial session:', initialSession?.user?.email);
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        if (initialSession?.user) {
          const adminStatus = await checkIsAdmin(initialSession.user.id);
          console.log('Initial admin status:', adminStatus);
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
        
        if (isMounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (isMounted) {
          setLoading(false);
          setAdminChecked(true);
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth state changed:', event, newSession?.user?.email);
        
        if (!isMounted) return;
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (newSession?.user) {
          // Small delay to ensure session is fully established
          await new Promise(resolve => setTimeout(resolve, 200));
          const adminStatus = await checkIsAdmin(newSession.user.id);
          console.log('Auth change admin status:', adminStatus);
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
        
        if (isMounted) {
          setLoading(false);
        }
      }
    );

    initializeAuth();

    // Safety timeout - 8 seconds
    const safetyTimeout = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('Auth loading timeout - forcing complete');
        setLoading(false);
        setAdminChecked(true);
      }
    }, 8000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [checkIsAdmin]);

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
    console.log('Signing in...');
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('Sign in error:', error);
      return { error, isAdmin: false };
    }
    
    // Check admin status immediately after login
    if (data.user) {
      console.log('Login successful, checking admin status...');
      const adminStatus = await checkIsAdmin(data.user.id);
      console.log('Sign in admin status:', adminStatus);
      setIsAdmin(adminStatus);
      setAdminChecked(true);
      return { error: null, isAdmin: adminStatus };
    }
    
    return { error: null, isAdmin: false };
  };

  const signOut = async () => {
    console.log('Signing out...');
    setIsAdmin(false);
    setAdminChecked(false);
    await supabase.auth.signOut();
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
