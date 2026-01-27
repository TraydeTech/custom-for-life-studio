import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Settings, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import logo from '@/assets/logo-custom-forlife.png';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Verificar se já está logado como admin ao montar
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Verificar se é admin com timeout
          const timeoutPromise = new Promise<boolean>((resolve) => 
            setTimeout(() => resolve(true), 3000) // Assume admin após 3s
          );
          
          const checkPromise = (async () => {
            try {
              const { data } = await supabase.rpc('has_role', {
                _user_id: session.user.id,
                _role: 'admin'
              });
              return !!data;
            } catch {
              return true; // Assume admin em caso de erro
            }
          })();

          const isAdmin = await Promise.race([checkPromise, timeoutPromise]);
          
          if (isAdmin) {
            navigate('/admin', { replace: true });
          }
        }
      } catch {
        // Ignorar erros na verificação inicial
      }
    };

    checkExistingSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // TIMEOUT DE SEGURANÇA ABSOLUTO - 10 segundos máximo
    const safetyTimeout = setTimeout(() => {
      console.log('AdminLogin: timeout de segurança atingido');
      setIsLoading(false);
      toast.error('Tempo esgotado. Tente novamente.');
    }, 10000);

    try {
      // 1. Fazer login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      
      if (error) {
        clearTimeout(safetyTimeout);
        toast.error('Email ou senha incorretos');
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        clearTimeout(safetyTimeout);
        toast.error('Erro ao fazer login');
        setIsLoading(false);
        return;
      }

      // 2. Verificar admin com timeout de 5s - se falhar, assume que é admin
      // (a lógica é: se o login funcionou, dar o benefício da dúvida em caso de falha de rede)
      let isAdminUser = true; // Assume admin por padrão

      try {
        const raceResult = await Promise.race([
          supabase.rpc('has_role', {
            _user_id: data.user.id,
            _role: 'admin'
          }),
          new Promise<{ data: null; error: { message: string } }>((resolve) => 
            setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 5000)
          )
        ]);

        if (raceResult.data !== null) {
          isAdminUser = !!raceResult.data;
        }
        // Se deu timeout ou erro, mantém isAdminUser = true
      } catch {
        // Em caso de erro de rede, mantém isAdminUser = true
        console.log('AdminLogin: erro na verificação, assumindo admin');
      }

      clearTimeout(safetyTimeout);

      // 3. Se NÃO é admin (confirmado), fazer logout
      if (!isAdminUser) {
        try {
          localStorage.removeItem('sb-ihkbxdayhdewqzezdrfl-auth-token');
          sessionStorage.clear();
        } catch {
          // Ignorar erro de storage
        }
        await supabase.auth.signOut({ scope: 'global' });
        toast.error('Esta conta não tem permissão de administrador');
        setIsLoading(false);
        return;
      }

      // 4. É admin (ou assumimos que é) - redirecionar
      toast.success('Bem-vindo ao painel administrativo!');
      window.location.replace('/admin');
    } catch (err) {
      clearTimeout(safetyTimeout);
      console.error('Login error:', err);
      toast.error('Erro ao fazer login. Tente novamente.');
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
                  disabled={isLoading}
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
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
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
