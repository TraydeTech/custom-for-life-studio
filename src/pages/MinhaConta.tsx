import { AccountLayout } from '@/components/account/AccountLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function MinhaConta() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({ full_name: '', phone: '', cpf: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Redirecionar se não estiver logado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [authLoading, user, navigate]);

  // Buscar perfil quando user estiver disponível
  useEffect(() => {
    if (!user?.id || hasFetched) return;
    
    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, phone, cpf')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Erro ao buscar perfil:', error);
          toast.error('Erro ao carregar dados');
        } else if (data) {
          setFormData({
            full_name: data.full_name || '',
            phone: data.phone || '',
            cpf: data.cpf || '',
          });
        }
      } catch (err) {
        console.error('Erro inesperado:', err);
      } finally {
        setIsLoading(false);
        setHasFetched(true);
      }
    };

    loadProfile();
  }, [user?.id, hasFetched]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          full_name: formData.full_name,
          phone: formData.phone,
          cpf: formData.cpf,
        }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Perfil atualizado com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      toast.error('Erro ao salvar perfil');
    } finally {
      setIsSaving(false);
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
  };

  // Mostrar loading enquanto auth carrega
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

  return (
    <AccountLayout title="Minha Conta">
      <Card>
        <CardHeader>
          <CardTitle>Dados Pessoais</CardTitle>
          <CardDescription>Atualize suas informações pessoais</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
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
                <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Seu nome completo"
                  disabled={isSaving}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                    placeholder="(00) 00000-0000"
                    disabled={isSaving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => setFormData(prev => ({ ...prev, cpf: formatCPF(e.target.value) }))}
                    placeholder="000.000.000-00"
                    disabled={isSaving}
                  />
                </div>
              </div>

              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
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
