import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  ShoppingCart, 
  User, 
  Menu, 
  X, 
  LogOut, 
  Package, 
  MapPin,
  Settings
} from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import logoImage from '@/assets/logo-custom-forlife.png';

export function Header() {
  const { user, signOut } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdminUser, setIsAdminUser] = useState<boolean | null>(null);

  // Verificar diretamente no banco se o usuário é admin
  useEffect(() => {
    let isMounted = true;
    
    const checkAdminStatus = async () => {
      if (!user) {
        if (isMounted) setIsAdminUser(null);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });

        if (isMounted) {
          setIsAdminUser(error ? false : !!data);
        }
      } catch {
        if (isMounted) setIsAdminUser(false);
      }
    };

    checkAdminStatus();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Quando admin acessa o site público, deslogar automaticamente
  useEffect(() => {
    if (isAdminUser === true && user) {
      // Admin tentando acessar site público - deslogar
      const logoutAdmin = async () => {
        await signOut();
        window.location.href = '/';
      };
      logoutAdmin();
    }
  }, [isAdminUser, user, signOut]);

  // Estados de exibição
  const isLoggedIn = !!user;
  const adminCheckComplete = isAdminUser !== null;
  const isAdmin = user && isAdminUser === true;
  // Cliente: usuário logado E verificação completa mostrando que NÃO é admin
  const isCustomer = user && adminCheckComplete && isAdminUser === false;
  // Enquanto verifica (APENAS se tiver usuário logado)
  const isCheckingStatus = user && !adminCheckComplete;
  // Visitante: não tem usuário logado
  const isVisitor = !user;
  
  // Extrair o primeiro nome do usuário
  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'Cliente';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/loja?busca=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
      window.location.href = '/';
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={logoImage} alt="Custom For Life" className="h-[50px] w-auto" />
        </Link>

        {/* Search Bar - Desktop */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar produtos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
        </form>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-4">
          <Link to="/loja">
            <Button variant="ghost">Produtos</Button>
          </Link>

          {isVisitor ? (
            // UI para visitantes NÃO logados
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost">Entrar</Button>
              </Link>
              <Link to="/cadastro">
                <Button>Criar Conta</Button>
              </Link>
              <Link 
                to="/admin/login" 
                className="p-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                title="Acesso Administrativo"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </div>
          ) : isCheckingStatus ? (
            // Verificando status do usuário logado - mostrar loading discreto
            <div className="flex items-center gap-2">
              <div className="animate-pulse h-8 w-20 bg-muted rounded"></div>
            </div>
          ) : isCustomer ? (
            // UI para CLIENTES logados
            <>
              <Link to="/carrinho" className="relative">
                <Button variant="ghost" size="icon">
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    <span className="hidden lg:inline text-sm">Olá, {userName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5 text-sm font-medium lg:hidden">
                    Olá, {userName}
                  </div>
                  <DropdownMenuSeparator className="lg:hidden" />
                  <DropdownMenuItem asChild>
                    <Link to="/minha-conta" className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      Minha Conta
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/minha-conta/pedidos" className="flex items-center">
                      <Package className="mr-2 h-4 w-4" />
                      Meus Pedidos
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/minha-conta/enderecos" className="flex items-center">
                      <MapPin className="mr-2 h-4 w-4" />
                      Endereços
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleSignOut}
                    className="text-destructive cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : isAdmin ? (
            // Admin será deslogado automaticamente - não mostrar UI
            null
          ) : null}
        </nav>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background p-4 space-y-4">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </form>

          <nav className="flex flex-col gap-2">
            <Link to="/loja" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start">Produtos</Button>
            </Link>
            
            {isVisitor ? (
              // Menu mobile para VISITANTES
              <>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">Entrar</Button>
                </Link>
                <Link to="/cadastro" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">Criar Conta</Button>
                </Link>
              </>
            ) : isCheckingStatus ? (
              // Verificando status
              <div className="px-4 py-2">
                <div className="animate-pulse h-8 w-32 bg-muted rounded"></div>
              </div>
            ) : isCustomer ? (
              // Menu mobile para CLIENTES
              <>
                <div className="px-4 py-2 text-sm font-medium text-primary">
                  Olá, {userName}! 👋
                </div>
                <Link to="/carrinho" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Carrinho {cartCount > 0 && `(${cartCount})`}
                  </Button>
                </Link>
                <Link to="/minha-conta" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    <User className="mr-2 h-4 w-4" />
                    Minha Conta
                  </Button>
                </Link>
                <Link to="/minha-conta/pedidos" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    <Package className="mr-2 h-4 w-4" />
                    Meus Pedidos
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive"
                  onClick={() => {
                    handleSignOut();
                    setMobileMenuOpen(false);
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </Button>
              </>
            ) : isAdmin ? (
              // Admin será deslogado automaticamente
              null
            ) : null}
          </nav>
        </div>
      )}
    </header>
  );
}
