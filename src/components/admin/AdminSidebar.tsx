import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Tags,
  LogOut,
  Home,
  Store,
  Wallet,
  Truck,
  BarChart3,
  MessageCircle,
  Kanban
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePendingOrdersCount } from '@/hooks/usePendingOrdersCount';
import { useLowStockCount } from '@/hooks/useLowStockProducts';
import { useOpenTicketsCount } from '@/hooks/useOpenTicketsCount';
import logo from '@/assets/logo-custom-forlife.png';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: Store, label: 'PDV', path: '/admin/pdv' },
  { icon: Package, label: 'Produtos', path: '/admin/produtos', showStockBadge: true },
  { icon: Tags, label: 'Categorias', path: '/admin/categorias' },
  { icon: ShoppingCart, label: 'Pedidos', path: '/admin/pedidos', showOrderBadge: true },
  { icon: Truck, label: 'Fornecedores', path: '/admin/fornecedores' },
  { icon: Wallet, label: 'Financeiro', path: '/admin/financeiro' },
  { icon: BarChart3, label: 'Relatórios', path: '/admin/relatorios' },
  { icon: MessageCircle, label: 'Chamados', path: '/admin/chamados', showTicketBadge: true },
  { icon: Users, label: 'Clientes', path: '/admin/clientes' },
];

export function AdminSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { data: pendingCount } = usePendingOrdersCount();
  const { totalCount: lowStockCount } = useLowStockCount();
  const { data: openTicketsCount } = useOpenTicketsCount();

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
            
            // Determine badge count based on item type
            let badgeCount = 0;
            if (item.showOrderBadge && pendingCount) {
              badgeCount = pendingCount;
            } else if (item.showStockBadge && lowStockCount) {
              badgeCount = lowStockCount;
            } else if (item.showTicketBadge && openTicketsCount) {
              badgeCount = openTicketsCount;
            }
            
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
                  <span className="font-medium flex-1">{item.label}</span>
                  {badgeCount > 0 && (
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "ml-auto h-5 min-w-5 flex items-center justify-center text-xs font-bold",
                        isActive 
                          ? "bg-primary-foreground/20 text-primary-foreground" 
                          : item.showStockBadge 
                            ? "bg-warning text-warning-foreground"
                            : "bg-destructive text-destructive-foreground"
                      )}
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </Badge>
                  )}
                </Link>
              </li>
            );
          })}
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
