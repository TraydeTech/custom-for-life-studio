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
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('full_name, phone, cpf')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message || 'Erro ao carregar perfil');
        setLoading(false);
        return;
      }

      setProfile({
        full_name: data?.full_name || userMetaName || '',
        phone: data?.phone || '',
        cpf: data?.cpf || '',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
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
      // Usar upsert para simplificar - mais rápido que check + update/insert
      const { error: saveError } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          full_name: newProfile.full_name,
          phone: newProfile.phone,
          cpf: newProfile.cpf,
        }, { onConflict: 'user_id' });

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
