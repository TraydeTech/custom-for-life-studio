import React, { useState, useEffect, useRef } from 'react';
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
import { supabase } from '@/integrations/supabase/client';

type SearchResult = { id: string; name: string; slug: string; images: string[] | null; price: number };

function SearchBar({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setOpen(false); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from('products')
        .select('id, name, slug, images, price')
        .eq('is_active', true)
        .ilike('name', `%${query.trim()}%`)
        .limit(6);
      setResults((data as SearchResult[]) || []);
      setOpen(true);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/loja?busca=${encodeURIComponent(query.trim())}`);
      setQuery(''); setOpen(false);
    }
  };

  const handleSelect = (slug: string) => {
    navigate(`/produto/${slug}`);
    setQuery(''); setOpen(false);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar produtos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            className="pl-10 w-full"
          />
        </div>
      </form>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-background border rounded-lg shadow-xl overflow-hidden">
          {loading ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">Nenhum produto encontrado</div>
          ) : (
            <>
              {results.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p.slug)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded border bg-white flex-shrink-0 overflow-hidden">
                    {p.images?.[0]
                      ? <img src={p.images[0]} className="w-full h-full object-contain" />
                      : <Package className="h-5 w-5 m-auto text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-primary font-semibold">
                      {p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => { navigate(`/loja?busca=${encodeURIComponent(query.trim())}`); setOpen(false); }}
                className="w-full px-4 py-2.5 text-sm text-primary font-medium hover:bg-muted transition-colors border-t text-center"
              >
                Ver todos os resultados para "{query}"
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Header() {
  // isAdmin e adminChecked já estão no AuthContext — sem chamada extra ao banco
  const { user, signOut, isAdmin, adminChecked } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLoggedIn = !!user;
  const isCustomer = user && (!adminChecked || !isAdmin);
  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'Cliente';

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
        <Link to="/" className="flex items-center group transition-transform hover:scale-105 active:scale-95">
          <div className="bg-[#FFFFFF] p-2 rounded-lg shadow-sm flex items-center justify-center">
            <img src={logoImage} alt="Custom For Life" className="h-[45px] md:h-[55px] lg:h-[65px] w-auto" />
          </div>
        </Link>

        {/* Search Bar - Desktop */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <SearchBar className="w-full" />
        </div>

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
            <div className="flex items-center gap-2">
              <Link to="/carrinho" className="relative mr-2">
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
          <SearchBar className="w-full" />

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
                <Link to="/carrinho" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Carrinho {cartCount > 0 && `(${cartCount})`}
                  </Button>
                </Link>
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
