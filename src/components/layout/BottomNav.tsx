import { Link, useLocation } from 'react-router-dom';
import { Home, Store, ShoppingCart, User } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

/**
 * Barra de navegação inferior estilo app (Shopee / Mercado Pago).
 *
 * Renderizada apenas dentro do app nativo (ver App.tsx). Fica fixa no rodapé,
 * respeita a safe-area (barra de gestos) e destaca a aba ativa. Dá ao app a
 * sensação de aplicativo de verdade em vez de site embrulhado.
 */
export function BottomNav() {
  const { pathname } = useLocation();
  const { cartCount } = useCart();
  const { user } = useAuth();

  const tabs = [
    { to: '/', label: 'Início', icon: Home, match: (p: string) => p === '/' },
    { to: '/loja', label: 'Loja', icon: Store, match: (p: string) => p.startsWith('/loja') || p.startsWith('/produto') },
    { to: '/carrinho', label: 'Carrinho', icon: ShoppingCart, match: (p: string) => p.startsWith('/carrinho'), badge: cartCount },
    {
      to: user ? '/minha-conta' : '/login',
      label: 'Conta',
      icon: User,
      match: (p: string) => p.startsWith('/minha-conta') || p.startsWith('/login') || p.startsWith('/cadastro') || p.startsWith('/meus-'),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegação principal"
    >
      <div className="flex items-stretch justify-around">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              to={tab.to}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <span className="relative">
                <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 1.9} />
                {tab.badge ? (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                ) : null}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
