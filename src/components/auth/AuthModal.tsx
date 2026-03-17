import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, ArrowLeft } from 'lucide-react';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'login' | 'register';
  onSuccess?: () => void;
}

export function AuthModal({ open, onOpenChange, defaultTab = 'login', onSuccess }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetState = () => {
    setLoginEmail(''); setLoginPassword('');
    setRegName(''); setRegEmail(''); setRegPassword(''); setRegConfirm('');
    setForgotEmail(''); setForgotSent(false); setShowForgot(false);
    setErrors({});
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetState();
    onOpenChange(v);
  };

  // ── Login ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!loginEmail.trim()) errs.loginEmail = 'Digite seu e-mail';
    if (!loginPassword) errs.loginPassword = 'Digite sua senha';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoginLoading(true);
    setErrors({});
    const { error } = await signIn(loginEmail, loginPassword);
    setLoginLoading(false);

    if (error) {
      const msg = error.message;
      if (msg.includes('Invalid login credentials')) {
        setErrors({ loginPassword: 'E-mail ou senha incorretos. Tente novamente.' });
      } else {
        setErrors({ loginPassword: msg });
      }
      return;
    }

    toast({ title: 'Login realizado!', description: 'Bem-vindo de volta.' });
    handleOpenChange(false);
    onSuccess?.();
  };

  // ── Register ──
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!regName.trim()) errs.regName = 'Digite seu nome';
    if (!regEmail.trim()) errs.regEmail = 'Digite um e-mail válido';
    if (regPassword.length < 6) errs.regPassword = 'A senha deve ter pelo menos 6 caracteres';
    if (regPassword !== regConfirm) errs.regConfirm = 'As senhas não coincidem';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setRegLoading(true);
    setErrors({});
    const { error } = await signUp(regEmail, regPassword, regName);
    setRegLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        setErrors({ regEmail: 'Este e-mail já está em uso. Tente entrar.' });
      } else {
        setErrors({ regEmail: error.message });
      }
      return;
    }

    toast({ title: 'Conta criada!', description: 'Bem-vindo à Custom For Life.' });
    handleOpenChange(false);
    onSuccess?.();
  };

  // ── Forgot Password ──
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) { setErrors({ forgotEmail: 'Digite seu e-mail' }); return; }

    setForgotLoading(true);
    setErrors({});
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setForgotLoading(false);
    setForgotSent(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-card border-border">
        {showForgot ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Recuperar senha</DialogTitle>
              <DialogDescription>
                Digite seu e-mail para receber o link de recuperação.
              </DialogDescription>
            </DialogHeader>

            {forgotSent ? (
              <div className="text-center py-4 space-y-3">
                <Mail className="h-10 w-10 mx-auto text-primary" />
                <p className="text-sm">Enviamos um link de recuperação para <strong>{forgotEmail}</strong>.</p>
                <Button variant="outline" onClick={() => { setShowForgot(false); setForgotSent(false); }}>
                  Voltar ao login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="forgot-email">E-mail</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="seu@email.com"
                  />
                  {errors.forgotEmail && <p className="text-xs text-destructive mt-1">{errors.forgotEmail}</p>}
                </div>
                <Button type="submit" className="w-full bg-[#1D9E75] hover:bg-[#178a63]" disabled={forgotLoading}>
                  {forgotLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar link de recuperação
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setShowForgot(false)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao login
                </Button>
              </form>
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Entre para continuar sua compra</DialogTitle>
              <DialogDescription>
                Faça login ou crie sua conta — é rápido e gratuito
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue={defaultTab} className="pt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Criar Conta</TabsTrigger>
              </TabsList>

              {/* ── Login Tab ── */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-2">
                  <div>
                    <Label htmlFor="login-email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        value={loginEmail}
                        onChange={e => setLoginEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="pl-10"
                      />
                    </div>
                    {errors.loginEmail && <p className="text-xs text-destructive mt-1">{errors.loginEmail}</p>}
                  </div>
                  <div>
                    <Label htmlFor="login-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        placeholder="••••••"
                        className="pl-10"
                      />
                    </div>
                    {errors.loginPassword && <p className="text-xs text-destructive mt-1">{errors.loginPassword}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                  <Button type="submit" className="w-full bg-[#1D9E75] hover:bg-[#178a63]" disabled={loginLoading}>
                    {loginLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>
                </form>
              </TabsContent>

              {/* ── Register Tab ── */}
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4 pt-2">
                  <div>
                    <Label htmlFor="reg-name">Nome completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-name"
                        value={regName}
                        onChange={e => setRegName(e.target.value)}
                        placeholder="Seu nome"
                        className="pl-10"
                      />
                    </div>
                    {errors.regName && <p className="text-xs text-destructive mt-1">{errors.regName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="reg-email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-email"
                        type="email"
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="pl-10"
                      />
                    </div>
                    {errors.regEmail && <p className="text-xs text-destructive mt-1">{errors.regEmail}</p>}
                  </div>
                  <div>
                    <Label htmlFor="reg-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-password"
                        type="password"
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="pl-10"
                      />
                    </div>
                    {errors.regPassword && <p className="text-xs text-destructive mt-1">{errors.regPassword}</p>}
                  </div>
                  <div>
                    <Label htmlFor="reg-confirm">Confirmar senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-confirm"
                        type="password"
                        value={regConfirm}
                        onChange={e => setRegConfirm(e.target.value)}
                        placeholder="Repita a senha"
                        className="pl-10"
                      />
                    </div>
                    {errors.regConfirm && <p className="text-xs text-destructive mt-1">{errors.regConfirm}</p>}
                  </div>
                  <Button type="submit" className="w-full bg-[#1D9E75] hover:bg-[#178a63]" disabled={regLoading}>
                    {regLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar Conta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
