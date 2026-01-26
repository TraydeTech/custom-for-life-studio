import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Profile {
  full_name: string | null;
  phone: string | null;
  cpf: string | null;
}

const EMPTY_PROFILE: Profile = { full_name: '', phone: '', cpf: '' };
const FETCH_TIMEOUT = 3000; // 3 segundos de timeout

export function useProfile(userId: string | undefined, userMetaName?: string | null) {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchProfile = useCallback(async () => {
    // Cancelar requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!userId) {
      setLoading(false);
      // Se não tem userId mas tem nome do metadata, usa como fallback
      if (userMetaName) {
        setProfile({ ...EMPTY_PROFILE, full_name: userMetaName });
      }
      return;
    }

    setLoading(true);
    setError(null);

    // Criar novo AbortController
    abortControllerRef.current = new AbortController();

    // Timeout de segurança
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setLoading(false);
      // Usar dados do metadata como fallback
      setProfile({
        full_name: userMetaName || '',
        phone: '',
        cpf: '',
      });
    }, FETCH_TIMEOUT);

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('full_name, phone, cpf')
        .eq('user_id', userId)
        .maybeSingle();

      clearTimeout(timeoutId);

      if (fetchError) {
        // Ignorar erros de abort
        if (fetchError.message?.includes('abort')) {
          return;
        }
        setError(fetchError.message || 'Erro ao carregar perfil');
        // Usar metadata como fallback
        setProfile({
          full_name: userMetaName || '',
          phone: '',
          cpf: '',
        });
        setLoading(false);
        return;
      }

      setProfile({
        full_name: data?.full_name || userMetaName || '',
        phone: data?.phone || '',
        cpf: data?.cpf || '',
      });
    } catch (err) {
      clearTimeout(timeoutId);
      // Ignorar erros de abort
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      // Usar metadata como fallback
      setProfile({
        full_name: userMetaName || '',
        phone: '',
        cpf: '',
      });
    } finally {
      setLoading(false);
    }
  }, [userId, userMetaName]);

  const saveProfile = useCallback(async (newProfile: Profile): Promise<boolean> => {
    if (!userId) {
      toast.error('Usuário não autenticado');
      return false;
    }

    setSaving(true);
    setError(null);

    try {
      // Verificar se perfil existe primeiro
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      let saveError;

      if (existing) {
        // Update
        const result = await supabase
          .from('profiles')
          .update({
            full_name: newProfile.full_name,
            phone: newProfile.phone,
            cpf: newProfile.cpf,
          })
          .eq('user_id', userId);
        saveError = result.error;
      } else {
        // Insert
        const result = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            full_name: newProfile.full_name,
            phone: newProfile.phone,
            cpf: newProfile.cpf,
          });
        saveError = result.error;
      }

      if (saveError) {
        throw new Error(saveError.message || 'Erro ao salvar perfil');
      }

      setProfile(newProfile);
      toast.success('Perfil atualizado com sucesso!');

      // Auth metadata em background
      supabase.auth.updateUser({ data: { full_name: newProfile.full_name } }).catch(() => {});

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
    
    // Cleanup: abortar requisição ao desmontar
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchProfile]);

  return {
    profile,
    setProfile,
    loading,
    saving,
    error,
    saveProfile,
    refetch: fetchProfile,
  };
}
