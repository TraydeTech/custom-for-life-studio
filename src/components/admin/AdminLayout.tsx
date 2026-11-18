import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { AdminSidebar } from './AdminSidebar';
import { useOrderNotifications } from '@/hooks/useOrderNotifications';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  useOrderNotifications();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:block shrink-0"><AdminSidebar /></div>
      <div className="min-w-0 flex-1">
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b bg-background p-3">
          <Button variant="outline" size="icon" aria-label="Abrir menu administrativo" onClick={() => setMenuOpen(true)}><Menu className="h-5 w-5" /></Button>
          <span className="font-semibold">Painel da loja</span>
          <Button variant="ghost" asChild><Link to="/">Ver loja</Link></Button>
        </header>
        <main className="min-w-0 p-4 sm:p-6 lg:p-8 overflow-x-auto">{children}</main>
      </div>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0 overflow-y-auto">
          <SheetHeader className="sr-only"><SheetTitle>Menu administrativo</SheetTitle><SheetDescription>Escolha uma área da loja.</SheetDescription></SheetHeader>
          <AdminSidebar />
        </SheetContent>
      </Sheet>
    </div>
  );
}
