import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Tags,
  LogOut,
  Store,
  Wallet,
  ChevronDown
} from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo-custom-forlife.png';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: Store, label: 'PDV', path: '/admin/pdv' },
  { icon: Package, label: 'Produtos', path: '/admin/produtos' },
  { icon: Tags, label: 'Categorias', path: '/admin/categorias' },
  { icon: ShoppingCart, label: 'Pedidos', path: '/admin/pedidos' },
  { icon: Users, label: 'Clientes', path: '/admin/clientes' },
];

const financeItems = [
  { label: 'Contas a Receber', path: '/admin/financeiro/receber' },
  { label: 'Contas a Pagar', path: '/admin/financeiro/pagar' },
];

export function AdminSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const [financeOpen, setFinanceOpen] = useState(
    location.pathname.startsWith('/admin/financeiro')
  );

  const handleLogout = async () => {
    await signOut();
    // Força reload completo para limpar todo estado e ir para o site
    window.location.href = '/';
  };

  return (
    <aside className="w-64 bg-card border-r border-border min-h-screen flex flex-col">
      <div className="p-6 border-b border-border">
        <Link to="/admin" className="flex items-center gap-3">
          <img src={logo} alt="Custom For Life" className="h-10 w-auto" />
        </Link>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/admin' && location.pathname.startsWith(item.path));
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
          
          {/* Menu Financeiro com submenu */}
          <li>
            <Collapsible open={financeOpen} onOpenChange={setFinanceOpen}>
              <CollapsibleTrigger className={cn(
                "flex items-center justify-between w-full px-4 py-3 rounded-lg transition-colors",
                location.pathname.startsWith('/admin/financeiro')
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5" />
                  <span className="font-medium">Financeiro</span>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  financeOpen && "rotate-180"
                )} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 mt-1 space-y-1">
                {financeItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          </li>
        </ul>
      </nav>

      <div className="p-4 border-t border-border">
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 text-destructive hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
