import { useState } from 'react';
import { CRUDModule } from '@/components/admin/CRUDModule';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { User, MapPin, ShoppingBag, Mail, Phone, Eye, Package, Download, FileImage } from 'lucide-react';
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
  const [zoomedItem, setZoomedItem] = useState<Tables<'order_items'> | null>(null);
  const [zoomedImageType, setZoomedImageType] = useState<'preview' | 'original'>('preview');

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(url, '_blank');
    }
  };

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
                              <div key={item.id} className="flex gap-4 text-sm items-start bg-muted/20 p-2 rounded-lg">
                                <div className="flex gap-2 shrink-0">
                                  {/* Produto/Prévia */}
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="w-16 h-16 bg-white rounded border overflow-hidden">
                                      {item.engraving_preview_url || item.product_image ? (
                                        <img 
                                          src={item.engraving_preview_url || item.product_image || ''} 
                                          className="w-full h-full object-contain cursor-pointer hover:opacity-80 transition-opacity"
                                          onClick={() => {
                                            setZoomedItem(item);
                                            setZoomedImageType('preview');
                                          }}
                                          title="Ver Prévia"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-muted"><Package className="h-6 w-6 text-muted-foreground" /></div>
                                      )}
                                    </div>
                                    <span className="text-[9px] text-muted-foreground uppercase font-semibold">Produto</span>
                                  </div>

                                  {/* Arquivo do Cliente */}
                                  {item.engraving_file_url && (
                                    <div className="flex flex-col items-center gap-1">
                                      <div className="w-16 h-16 bg-white rounded border overflow-hidden relative group">
                                        <img 
                                          src={item.engraving_file_url} 
                                          className="w-full h-full object-contain cursor-pointer hover:opacity-80 transition-opacity"
                                          onClick={() => {
                                            setZoomedItem(item);
                                            setZoomedImageType('original');
                                          }}
                                          title="Ver Arquivo Original"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                          <Eye className="h-4 w-4 text-white" />
                                        </div>
                                      </div>
                                      <span className="text-[9px] text-muted-foreground uppercase font-semibold">Arquivo</span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0 pt-1">
                                  <p className="font-medium truncate">{item.product_name}</p>
                                  {item.engraving_text && (
                                    <p className="text-xs text-primary font-medium mt-1">Texto: "{item.engraving_text}"</p>
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

        <Dialog open={!!zoomedItem} onOpenChange={() => setZoomedItem(null)}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white border-none shadow-2xl [&>button]:text-slate-900 [&>button]:opacity-100 [&>button:hover]:bg-slate-100">
            <div className="absolute top-4 left-6 z-10">
              <span className="text-lg font-mono font-bold text-slate-900">
                {selectedCustomer?.orders.find(o => o.items.some(i => i.id === zoomedItem?.id))?.order_number}
              </span>
            </div>
            <div className="p-0 bg-white">
              <div className="flex items-center justify-center bg-white min-h-[40vh] relative group">
                {zoomedItem && (
                  <img 
                    src={zoomedImageType === 'preview' 
                      ? (zoomedItem.engraving_preview_url || zoomedItem.product_image || '') 
                      : (zoomedItem.engraving_file_url || '')} 
                    alt="Zoom" 
                    className="max-w-full max-h-[70vh] object-contain transition-transform duration-300" 
                  />
                )}
              </div>
              
              <div className="p-6 bg-slate-50 border-t space-y-4">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <div className="space-y-1">
                  </div>
                  
                  <div className="flex gap-2">
                    {zoomedItem?.engraving_file_url && (
                      <Button 
                        size="sm"
                        variant={zoomedImageType === 'original' ? 'default' : 'outline'}
                        onClick={() => setZoomedImageType(zoomedImageType === 'preview' ? 'original' : 'preview')}
                        className={`gap-2 font-semibold ${zoomedImageType === 'preview' ? 'border-primary text-primary hover:bg-primary hover:text-white' : ''}`}
                      >
                        <FileImage className="h-4 w-4" />
                        {zoomedImageType === 'preview' ? 'Ver Arquivo Original' : 'Voltar para Prévia'}
                      </Button>
                    )}
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="gap-2 bg-white border-primary text-primary hover:bg-primary hover:text-white transition-all font-semibold"
                      onClick={() => {
                        const url = zoomedImageType === 'preview' 
                          ? (zoomedItem?.engraving_preview_url || zoomedItem?.product_image) 
                          : zoomedItem?.engraving_file_url;
                        if (url) handleDownload(url, `arquivo-${zoomedItem?.id?.substring(0, 8) || 'item'}-${zoomedImageType}.png`);
                      }}
                    >
                      <Download className="h-4 w-4" />
                      Download {zoomedImageType === 'preview' ? 'Prévia' : 'Arquivo'}
                    </Button>
                  </div>
                </div>

                {zoomedItem?.engraving_text && (
                  <div className="p-4 bg-white rounded-xl border-2 border-primary/10 shadow-sm">
                    <p className="text-[10px] text-primary uppercase font-black tracking-widest mb-1">Texto para Gravação</p>
                    <p className="text-2xl font-black text-slate-900 leading-tight">"{zoomedItem.engraving_text}"</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
