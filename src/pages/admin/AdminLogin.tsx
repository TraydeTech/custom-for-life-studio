import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Settings, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import logo from '@/assets/logo-custom-forlife.png';

export default function AdminLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Login direto com Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      
      if (error) {
        toast.error('Email ou senha incorretos');
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        toast.error('Erro ao fazer login');
        setIsLoading(false);
        return;
      }

      // Verificar se é admin com timeout
      const checkAdminWithTimeout = async (): Promise<boolean> => {
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.log('Admin check timeout');
            resolve(false);
          }, 5000);

          supabase.rpc('has_role', {
            _user_id: data.user.id,
            _role: 'admin'
          }).then(({ data: isAdminResult, error: roleError }) => {
            clearTimeout(timeout);
            if (roleError) {
              console.error('Role check error:', roleError);
              resolve(false);
            } else {
              resolve(!!isAdminResult);
            }
          });
        });
      };

      const isAdminUser = await checkAdminWithTimeout();

      if (!isAdminUser) {
        // Não é admin - limpar e sair
        try {
          localStorage.removeItem('sb-ihkbxdayhdewqzezdrfl-auth-token');
          sessionStorage.clear();
        } catch (e) {
          console.error('Storage clear error:', e);
        }
        await supabase.auth.signOut({ scope: 'global' });
        toast.error('Esta conta não tem permissão de administrador');
        setIsLoading(false);
        return;
      }

      // É admin - redirecionar imediatamente
      toast.success('Bem-vindo ao painel administrativo!');
      
      // Usar replace para evitar voltar para login
      window.location.replace('/admin');
    } catch (err) {
      console.error('Login error:', err);
      toast.error('Erro ao fazer login');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao site
        </Link>

        <Card className="border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <img src={logo} alt="Custom For Life" className="h-16 w-auto mx-auto" />
            </div>
            <div className="w-12 h-12 mx-auto mb-2 bg-primary/20 rounded-xl flex items-center justify-center">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-heading">Painel Administrativo</CardTitle>
            <CardDescription>
              Acesso restrito para administradores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="admin@customforlife.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
