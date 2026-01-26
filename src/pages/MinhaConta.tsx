import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AccountLayout } from '@/components/account/AccountLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Profile {
  full_name: string;
  phone: string;
  cpf: string;
}

const EMPTY_PROFILE: Profile = { full_name: '', phone: '', cpf: '' };

// Função para buscar perfil
const fetchProfile = async (userId: string): Promise<Profile> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, phone, cpf')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  return {
    full_name: data?.full_name || '',
    phone: data?.phone || '',
    cpf: data?.cpf || '',
  };
};

// Função para salvar perfil
const saveProfile = async ({ userId, profile }: { userId: string; profile: Profile }) => {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      user_id: userId,
      full_name: profile.full_name,
      phone: profile.phone,
      cpf: profile.cpf,
    }, { onConflict: 'user_id' });

  if (error) throw error;
  return profile;
};

export default function MinhaConta() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<Profile>(EMPTY_PROFILE);

  // Query para buscar perfil com cache
  const { 
    data: profile, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
    retry: 2,
    retryDelay: 500,
  });

  // Mutation para salvar
  const mutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: (savedProfile) => {
      queryClient.setQueryData(['profile', user?.id], savedProfile);
      toast.success('Perfil atualizado com sucesso!');
      // Atualizar metadata em background
      supabase.auth.updateUser({ data: { full_name: savedProfile.full_name } }).catch(() => {});
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao salvar perfil');
    },
  });

  // Sincronizar formData com dados carregados
  useEffect(() => {
    if (profile) {
      setFormData(profile);
    } else if (user?.user_metadata?.full_name && !isLoading) {
      // Fallback para metadata se não houver perfil
      setFormData(prev => ({
        ...prev,
        full_name: (user.user_metadata.full_name as string) || prev.full_name,
      }));
    }
  }, [profile, user?.user_metadata?.full_name, isLoading]);

  // Redirect se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [authLoading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    mutation.mutate({ userId: user.id, profile: formData });
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

  // Loading inicial do auth
  if (authLoading) {
    return (
      <AccountLayout title="Minha Conta">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </AccountLayout>
    );
  }

  const showError = error && !isLoading;

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
          {showError && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-destructive font-medium">Erro ao carregar</p>
                <p className="text-sm text-destructive/80">{(error as Error).message}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetch()}
                className="flex-shrink-0"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Tentar novamente
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
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
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Seu nome completo"
                  disabled={mutation.isPending}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    disabled={mutation.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    disabled={mutation.isPending}
                  />
                </div>
              </div>

              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
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
