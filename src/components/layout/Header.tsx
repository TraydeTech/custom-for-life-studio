import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  // isAdmin e adminChecked já estão no AuthContext — sem chamada extra ao banco
  const { user, signOut, isAdmin, adminChecked } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isLoggedIn = !!user;
  const isCustomer = user && (!adminChecked || !isAdmin);
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
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      window.location.replace('/');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container flex min-h-[90px] lg:min-h-[100px] items-center justify-between py-2 transition-all duration-300">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group transition-transform hover:scale-105 active:scale-95">
          <img src={logoImage} alt="Custom For Life" className="h-[60px] md:h-[75px] lg:h-[85px] w-auto drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
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
        <nav className="hidden md:flex items-center gap-4 text-foreground">
          <Link to="/loja">
            <Button variant="ghost" className="text-foreground hover:text-primary hover:bg-white/5">Produtos</Button>
          </Link>

          {isCustomer ? (
            // UI para CLIENTES logados
            <>
              <Link to="/carrinho" className="relative">
                <Button variant="ghost" size="icon" className="text-foreground hover:text-primary hover:bg-white/5">
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs flex items-center justify-center font-bold text-black"
                      style={{ backgroundColor: '#EF9F27' }}
                    >
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 text-foreground hover:text-primary hover:bg-white/5">
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
                  <div
                    role="menuitem"
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-muted"
                    onClick={handleSignOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : isAdmin ? (
            // UI para ADMIN logado - apenas acesso ao painel e sair
            <div className="flex items-center gap-2">
              <Link to="/admin">
                <Button variant="ghost" size="icon" title="Painel Administrativo" className="text-foreground hover:text-primary hover:bg-white/5">
                  <Settings className="h-5 w-5" />
                </Button>
              </Link>
              <Button 
                variant="ghost" 
                size="icon"
                className="text-foreground hover:text-primary hover:bg-white/5"
                onClick={handleSignOut}
                title="Sair"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            // ⚠️ ATENÇÃO: ESTA SEÇÃO NÃO PODE SER ALTERADA ⚠️
            // UI para visitantes NÃO logados - Menu padrão obrigatório:
            // Produtos | Entrar | Criar Conta | Ícone Admin
            // Esta estrutura é FIXA e não pode ser modificada por nenhuma alteração futura
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" className="text-foreground hover:text-primary hover:bg-white/5">Entrar</Button>
              </Link>
              <Link to="/cadastro">
                <Button variant="hero">Criar Conta</Button>
              </Link>
              <Link 
                to="/admin/login" 
                className="p-2 text-muted-foreground hover:text-primary transition-colors"
                title="Acesso Administrativo"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-foreground hover:bg-white/5"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/50 bg-background p-4 space-y-4 text-foreground animate-fade-in">
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
              <Button variant="ghost" className="w-full justify-start text-foreground">Produtos</Button>
            </Link>
            
            {isCustomer ? (
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
              // Menu mobile para ADMIN
              <>
                <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    <Settings className="mr-2 h-4 w-4" />
                    Painel Admin
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
            ) : !isLoggedIn && (
              // ⚠️ ATENÇÃO: ESTA SEÇÃO NÃO PODE SER ALTERADA ⚠️
              // Menu mobile para VISITANTES - Menu padrão obrigatório
              <>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">Entrar</Button>
                </Link>
                <Link to="/cadastro" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">Criar Conta</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
