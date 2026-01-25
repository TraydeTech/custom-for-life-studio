import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Profile {
  full_name: string | null;
  phone: string | null;
  cpf: string | null;
}

interface ProfileData {
  full_name: string | null;
  phone: string | null;
  cpf: string | null;
}

const EMPTY_PROFILE: Profile = { full_name: '', phone: '', cpf: '' };
const TIMEOUT_MS = 8000;

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[useProfile] Buscando perfil para:', userId);
      
      // Criar timeout promise
      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) => {
        setTimeout(() => {
          resolve({ data: null, error: new Error('Tempo esgotado ao carregar perfil') });
        }, TIMEOUT_MS);
      });

      // Executar query com timeout
      const queryPromise = supabase
        .from('profiles')
        .select('full_name, phone, cpf')
        .eq('user_id', userId)
        .maybeSingle()
        .then((result) => result);

      const result = await Promise.race([queryPromise, timeoutPromise]);

      if (result.error) {
        console.error('[useProfile] Erro ao buscar:', result.error);
        setError(result.error.message || 'Erro ao carregar perfil');
        return;
      }

      console.log('[useProfile] Perfil carregado:', result.data);
      const data = result.data as ProfileData | null;
      setProfile({
        full_name: data?.full_name || '',
        phone: data?.phone || '',
        cpf: data?.cpf || '',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('[useProfile] Erro inesperado:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const saveProfile = useCallback(async (newProfile: Profile): Promise<boolean> => {
    if (!userId) {
      toast.error('Usuário não autenticado');
      return false;
    }

    setSaving(true);
    setError(null);

    try {
      console.log('[useProfile] Iniciando salvamento para:', userId);

      // Timeout para operações
      const createTimeout = () => new Promise<{ data: null; error: Error }>((resolve) => {
        setTimeout(() => {
          resolve({ data: null, error: new Error('Tempo esgotado. Verifique sua conexão.') });
        }, TIMEOUT_MS);
      });

      // 1. Verificar se perfil existe
      const checkQuery = supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()
        .then((r) => r);

      const checkResult = await Promise.race([checkQuery, createTimeout()]);

      if (checkResult.error) {
        throw new Error(checkResult.error.message || 'Erro ao verificar perfil');
      }

      const exists = !!checkResult.data;
      console.log('[useProfile] Perfil existente?', exists);

      // 2. Salvar (UPDATE ou INSERT)
      let saveResult;

      if (exists) {
        console.log('[useProfile] Fazendo UPDATE...');
        const updateQuery = supabase
          .from('profiles')
          .update({
            full_name: newProfile.full_name,
            phone: newProfile.phone,
            cpf: newProfile.cpf,
          })
          .eq('user_id', userId)
          .select()
          .then((r) => r);

        saveResult = await Promise.race([updateQuery, createTimeout()]);
      } else {
        console.log('[useProfile] Fazendo INSERT...');
        const insertQuery = supabase
          .from('profiles')
          .insert({
            user_id: userId,
            full_name: newProfile.full_name,
            phone: newProfile.phone,
            cpf: newProfile.cpf,
          })
          .select()
          .then((r) => r);

        saveResult = await Promise.race([insertQuery, createTimeout()]);
      }

      console.log('[useProfile] Resultado:', saveResult);

      if (saveResult.error) {
        throw new Error(saveResult.error.message || 'Erro ao salvar perfil');
      }

      setProfile(newProfile);
      toast.success('Perfil atualizado com sucesso!');

      // Auth metadata em background
      supabase.auth.updateUser({ data: { full_name: newProfile.full_name } }).catch(() => {});

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('[useProfile] Falha ao salvar:', message);
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
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
