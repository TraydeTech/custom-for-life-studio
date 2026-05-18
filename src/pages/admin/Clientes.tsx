import { useState } from 'react';
import { CRUDModule } from '@/components/admin/CRUDModule';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { User, MapPin, ShoppingBag, Mail, Phone, Eye, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

type Profile = Tables<'profiles'>;
type Address = Tables<'addresses'>;
type Order = Tables<'orders'>;

interface CustomerDetails extends Profile {
  addresses: Address[];
  orders: (Order & { items: Tables<'order_items'>[] })[];
}

export default function AdminClientes() {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const handleViewDetails = async (profile: Profile) => {
    const [addrRes, ordersRes] = await Promise.all([
      supabase.from('addresses').select('*').eq('user_id', profile.user_id),
      supabase.from('orders').select('*').eq('user_id', profile.user_id).order('created_at', { ascending: false }),
    ]);

    const orders = ordersRes.data || [];
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id);
        return { ...order, items: items || [] };
      })
    );

    setSelectedCustomer({
      ...profile,
      addresses: addrRes.data || [],
      orders: ordersWithItems,
    });
    setIsDetailsOpen(true);
  };

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <CRUDModule<Profile>
          title="Clientes"
          tableName="profiles"
          queryKey="admin-customers"
          searchPlaceholder="Buscar por nome, telefone ou CPF..."
          searchFields={['full_name', 'phone', 'cpf', 'email']}
          initialData={{
            full_name: '',
            email: '',
            phone: '',
            cpf: '',
            company_name: '',
          }}
          columns={[
            { 
              header: 'Cliente', 
              key: 'full_name',
              render: (val) => (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  {val || 'Sem nome'}
                </div>
              )
            },
            { header: 'E-mail', key: 'email' },
            { 
              header: 'Telefone', 
              key: 'phone',
              render: (val) => val ? val.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : '-'
            },
            { 
              header: 'CPF/CNPJ', 
              key: 'cpf',
              render: (_, item) => item.cpf || item.cnpj || '-'
            },
          ]}
          formFields={[
            { label: 'Nome Completo', key: 'full_name', required: true },
            { label: 'E-mail', key: 'email', type: 'email', required: true },
            { label: 'Telefone', key: 'phone' },
            { label: 'CPF', key: 'cpf' },
            { label: 'CNPJ', key: 'cnpj' },
            { label: 'Razão Social (PJ)', key: 'company_name' },
          ]}
          customActions={(item) => (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => handleViewDetails(item)}
              title="Ver Detalhes"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
        />

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {selectedCustomer?.full_name || 'Detalhes do Cliente'}
              </DialogTitle>
            </DialogHeader>

            {selectedCustomer && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">E-mail</p>
                    <p className="font-medium flex items-center gap-2"><Mail className="h-3 w-3" />{selectedCustomer.email || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="font-medium flex items-center gap-2"><Phone className="h-3 w-3" />{selectedCustomer.phone || '-'}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <MapPin className="h-5 w-5" /> Endereços
                  </h3>
                  {selectedCustomer.addresses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedCustomer.addresses.map((addr) => (
                        <div key={addr.id} className="p-3 border rounded-lg text-sm">
                          <p className="font-bold">{addr.label || 'Endereço'}</p>
                          <p>{addr.street}, {addr.number}</p>
                          <p>{addr.neighborhood}, {addr.city}-{addr.state}</p>
                          <p>CEP: {addr.zip_code}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <ShoppingBag className="h-5 w-5" /> Pedidos
                  </h3>
                  {selectedCustomer.orders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum pedido realizado</p>
                  ) : (
                    <div className="border rounded-lg divide-y">
                      {selectedCustomer.orders.map((order) => (
                        <div key={order.id} className="p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-mono text-sm font-bold">{order.order_number}</p>
                              <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-primary">{formatCurrency(Number(order.total))}</p>
                              <Badge variant="secondary" className="text-[10px] h-4">{order.status}</Badge>
                            </div>
                          </div>

                          <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                            {order.items.map((item) => (
                              <div key={item.id} className="flex gap-3 text-sm items-start">
                                <div className="w-12 h-12 bg-white rounded border overflow-hidden flex-shrink-0">
                                  {item.engraving_preview_url || item.product_image ? (
                                    <img 
                                      src={item.engraving_preview_url || item.product_image || ''} 
                                      className="w-full h-full object-contain cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() => setZoomedImage(item.engraving_preview_url || item.product_image)}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-muted"><Package className="h-6 w-6 text-muted-foreground" /></div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{item.product_name}</p>
                                  {item.engraving_text && (
                                    <p className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded w-fit mt-0.5">
                                      Gravação: <strong>"{item.engraving_text}"</strong>
                                    </p>
                                  )}
                                  {item.engraving_file_url && (
                                    <a 
                                      href={item.engraving_file_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-[10px] text-blue-600 flex items-center gap-1 hover:underline mt-0.5"
                                    >
                                      <Eye className="h-2.5 w-2.5" /> Ver Imagem Original
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!zoomedImage} onOpenChange={() => setZoomedImage(null)}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white">
            <DialogHeader className="p-4 border-b">
              <DialogTitle>Visualização da Imagem</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4 bg-white">
              {zoomedImage && (
                <img 
                  src={zoomedImage} 
                  alt="Zoom" 
                  className="max-w-full max-h-[70vh] object-contain" 
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
