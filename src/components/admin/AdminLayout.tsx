import { AdminSidebar } from './AdminSidebar';
import { useOrderNotifications } from '@/hooks/useOrderNotifications';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  // Enable real-time order notifications for admin
  useOrderNotifications();

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
