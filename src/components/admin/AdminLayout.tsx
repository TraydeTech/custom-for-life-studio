import { AdminSidebar } from './AdminSidebar';
import { useOrderNotifications } from '@/hooks/useOrderNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { SupportWidget } from '@/components/support/SupportWidget';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  // Enable real-time order notifications for admin
  useOrderNotifications();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
      <SupportWidget
        clientSystem="custom-forlife"
        userName={user?.user_metadata?.full_name || 'Custom ForLife'}
        userEmail={user?.email || ''}
      />
    </div>
  );
}
