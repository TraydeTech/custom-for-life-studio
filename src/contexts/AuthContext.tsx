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
  checkIsAdmin: (userId: string) => Promise<boolean>;
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
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (error) {
        console.error('Error checking admin role:', error);
        return false;
      }
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
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        if (initialSession?.user) {
          const adminStatus = await checkIsAdmin(initialSession.user.id);
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
        if (!isMounted) return;
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (newSession?.user) {
          // Delay to ensure database trigger has completed
          await new Promise(resolve => setTimeout(resolve, 100));
          const adminStatus = await checkIsAdmin(newSession.user.id);
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

    // Safety timeout
    const safetyTimeout = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('Auth loading timeout - forcing complete');
        setLoading(false);
        setAdminChecked(true);
      }
    }, 5000);

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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return { error, isAdmin: false };
    }
    
    // Check admin status immediately after login
    if (data.user) {
      const adminStatus = await checkIsAdmin(data.user.id);
      setIsAdmin(adminStatus);
      setAdminChecked(true);
      return { error: null, isAdmin: adminStatus };
    }
    
    return { error: null, isAdmin: false };
  };

  const signOut = async () => {
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
      signOut,
      checkIsAdmin
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
