import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Profile {
  full_name: string | null;
  phone: string | null;
  cpf: string | null;
}

const EMPTY_PROFILE: Profile = { full_name: '', phone: '', cpf: '' };

export function useProfile(userId: string | undefined, userMetaName?: string | null) {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Efeito para buscar perfil quando userId estiver disponível
  useEffect(() => {
    // Se já buscou ou não tem userId, não fazer nada
    if (!userId) {
      return;
    }

    // Evitar múltiplas buscas para o mesmo userId
    if (hasFetched) {
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('full_name, phone, cpf')
          .eq('user_id', userId)
          .maybeSingle();

        if (fetchError) {
          console.error('[useProfile] Erro:', fetchError);
          setError(fetchError.message);
          // Fallback para metadata
          setProfile({
            full_name: userMetaName || '',
            phone: '',
            cpf: '',
          });
        } else if (data) {
          setProfile({
            full_name: data.full_name ?? '',
            phone: data.phone ?? '',
            cpf: data.cpf ?? '',
          });
        } else {
          // Perfil não existe, usar metadata
          setProfile({
            full_name: userMetaName || '',
            phone: '',
            cpf: '',
          });
        }
      } catch (err) {
        console.error('[useProfile] Erro inesperado:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        setProfile({
          full_name: userMetaName || '',
          phone: '',
          cpf: '',
        });
      } finally {
        setLoading(false);
        setHasFetched(true);
      }
    };

    fetchProfile();
  }, [userId, userMetaName, hasFetched]);

  const saveProfile = useCallback(async (newProfile: Profile): Promise<boolean> => {
    if (!userId) {
      toast.error('Usuário não autenticado');
      return false;
    }

    setSaving(true);
    setError(null);

    try {
      // Verificar se perfil existe
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      let saveError;

      if (existing) {
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
        throw new Error(saveError.message);
      }

      setProfile(newProfile);
      toast.success('Perfil atualizado com sucesso!');
      
      // Atualizar metadata em background
      supabase.auth.updateUser({ data: { full_name: newProfile.full_name } }).catch(() => {});

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar';
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [userId]);

  const refetch = useCallback(() => {
    setHasFetched(false);
  }, []);

  return {
    profile,
    setProfile,
    loading,
    saving,
    error,
    saveProfile,
    refetch,
  };
}
