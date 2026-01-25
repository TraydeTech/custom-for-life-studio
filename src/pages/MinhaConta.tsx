import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AccountLayout } from '@/components/account/AccountLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Profile {
  full_name: string | null;
  phone: string | null;
  cpf: string | null;
}

export default function MinhaConta() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>({ full_name: '', phone: '', cpf: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }

    if (user) {
      fetchProfile();
    }

    // Timeout de segurança para evitar loading infinito
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [user, authLoading, navigate]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone, cpf')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
      }
      
      // Mesmo se não houver perfil, mostrar os campos vazios
      setProfile({
        full_name: data?.full_name || user?.user_metadata?.full_name || '',
        phone: data?.phone || '',
        cpf: data?.cpf || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Timeout de segurança - máximo 2 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      setSaving(false);
      toast.error('Tempo esgotado. Tente novamente.');
    }, 2000);

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user!.id,
          full_name: profile.full_name,
          phone: profile.phone,
          cpf: profile.cpf,
        }, { 
          onConflict: 'user_id' 
        });

      clearTimeout(timeoutId);

      if (error) {
        toast.error('Erro ao atualizar perfil');
        setSaving(false);
        return;
      }

      toast.success('Perfil atualizado com sucesso!');
      setSaving(false);

      // Auth metadata em background
      supabase.auth.updateUser({ data: { full_name: profile.full_name } }).catch(() => {});
    } catch {
      clearTimeout(timeoutId);
      toast.error('Erro ao atualizar perfil');
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

  if (authLoading || loading) {
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
                value={profile.full_name || ''}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Seu nome completo"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={profile.phone || ''}
                  onChange={(e) => setProfile({ ...profile, phone: formatPhone(e.target.value) })}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={profile.cpf || ''}
                  onChange={(e) => setProfile({ ...profile, cpf: formatCPF(e.target.value) })}
                  placeholder="000.000.000-00"
                  maxLength={14}
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
        </CardContent>
      </Card>
    </AccountLayout>
  );
}
