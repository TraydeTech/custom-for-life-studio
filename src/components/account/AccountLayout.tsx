import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { User, Package, MapPin, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountLayoutProps {
  children: React.ReactNode;
  title: string;
}

const menuItems = [
  { label: 'Minha Conta', href: '/minha-conta', icon: User },
  { label: 'Meus Pedidos', href: '/minha-conta/pedidos', icon: Package },
  { label: 'Endereços', href: '/minha-conta/enderecos', icon: MapPin },
  { label: 'Meus Chamados', href: '/minha-conta/chamados', icon: MessageCircle },
];

export function AccountLayout({ children, title }: AccountLayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-8">
        <h1 className="text-2xl font-bold mb-6">{title}</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Content */}
          <div className="md:col-span-3">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
