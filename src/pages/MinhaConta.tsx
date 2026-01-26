import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AccountLayout } from '@/components/account/AccountLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Profile {
  full_name: string;
  phone: string;
  cpf: string;
}

export default function MinhaConta() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<Profile>({ full_name: '', phone: '', cpf: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar perfil diretamente quando user estiver disponível
  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('full_name, phone, cpf')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        setProfile({
          full_name: data.full_name || '',
          phone: data.phone || '',
          cpf: data.cpf || '',
        });
      } else {
        // Usar metadata como fallback
        setProfile({
          full_name: (user.user_metadata?.full_name as string) || '',
          phone: '',
          cpf: '',
        });
      }
    } catch (err) {
      console.error('[MinhaConta] Erro ao buscar perfil:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar perfil');
      // Fallback para metadata
      setProfile({
        full_name: (user.user_metadata?.full_name as string) || '',
        phone: '',
        cpf: '',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.user_metadata?.full_name]);

  // Buscar perfil quando user estiver disponível
  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    } else if (!authLoading) {
      // Se não está carregando e não tem user, redirecionar
      navigate('/login');
    }
  }, [user?.id, authLoading, fetchProfile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Verificar se perfil existe
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let saveError;

      if (existing) {
        const result = await supabase
          .from('profiles')
          .update({
            full_name: profile.full_name,
            phone: profile.phone,
            cpf: profile.cpf,
          })
          .eq('user_id', user.id);
        saveError = result.error;
      } else {
        const result = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            full_name: profile.full_name,
            phone: profile.phone,
            cpf: profile.cpf,
          });
        saveError = result.error;
      }

      if (saveError) {
        throw saveError;
      }

      toast.success('Perfil atualizado com sucesso!');
      
      // Atualizar metadata em background
      supabase.auth.updateUser({ data: { full_name: profile.full_name } }).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar perfil';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return value;
  };

  // Mostrar loading apenas se auth está carregando E não temos user
  if (authLoading && !user) {
    return (
      <AccountLayout title="Minha Conta">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout title="Minha Conta">
      <Card>
        <CardHeader>
          <CardTitle>Dados Pessoais</CardTitle>
          <CardDescription>
            Atualize suas informações pessoais
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-destructive font-medium">Erro</p>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchProfile}
                className="flex-shrink-0"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Tentar novamente
              </Button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Carregando...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  O email não pode ser alterado
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="Seu nome completo"
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: formatPhone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={profile.cpf}
                    onChange={(e) => setProfile({ ...profile, cpf: formatCPF(e.target.value) })}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    disabled={saving}
                  />
                </div>
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AccountLayout>
  );
}
