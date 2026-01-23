import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Settings, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import logo from '@/assets/logo-custom-forlife.png';

// Código secreto para criar conta admin (mude isso para algo seguro)
const ADMIN_SECRET_CODE = 'CUSTOMFORLIFE2024';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [secretCode, setSecretCode] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signIn(loginEmail, loginPassword);
      
      if (error) {
        toast.error('Email ou senha incorretos');
        return;
      }

      // Verificar se é admin
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (roleData) {
          toast.success('Bem-vindo ao painel administrativo!');
          navigate('/admin');
        } else {
          await supabase.auth.signOut();
          toast.error('Esta conta não tem permissão de administrador');
        }
      }
    } catch (error) {
      toast.error('Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar código secreto
    if (secretCode !== ADMIN_SECRET_CODE) {
      toast.error('Código de acesso inválido');
      return;
    }

    setIsLoading(true);

    try {
      // Criar usuário
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: registerEmail,
        password: registerPassword,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: registerName,
          },
        },
      });

      if (authError) {
        toast.error('Erro ao criar conta: ' + authError.message);
        return;
      }

      if (authData.user) {
        // Adicionar role de admin
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: 'admin' })
          .eq('user_id', authData.user.id);

        if (roleError) {
          console.error('Erro ao definir role:', roleError);
          // Tentar inserir se não existir
          await supabase
            .from('user_roles')
            .insert({ user_id: authData.user.id, role: 'admin' });
        }

        toast.success('Conta de administrador criada com sucesso!');
        navigate('/admin');
      }
    } catch (error) {
      toast.error('Erro ao criar conta');
    } finally {
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
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Criar Conta</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
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
              </TabsContent>
              
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nome Completo</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Seu nome"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="admin@customforlife.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="register-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 6 caracteres"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        minLength={6}
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
                  <div className="space-y-2">
                    <Label htmlFor="secret-code">Código de Acesso</Label>
                    <Input
                      id="secret-code"
                      type="password"
                      placeholder="Código secreto de administrador"
                      value={secretCode}
                      onChange={(e) => setSecretCode(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Digite o código fornecido pelo administrador do sistema
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Criando conta...' : 'Criar Conta Admin'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
