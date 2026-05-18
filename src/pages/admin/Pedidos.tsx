import { useState } from 'react';
import { CRUDModule } from '@/components/admin/CRUDModule';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Tables, Constants } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { ShoppingBag, Eye, Printer, Globe, Store, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

type Order = Tables<'orders'>;
type OrderItem = Tables<'order_items'>;

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-500',
  paid: 'bg-blue-500/20 text-blue-500',
  processing: 'bg-purple-500/20 text-purple-500',
  shipped: 'bg-cyan-500/20 text-cyan-500',
  delivered: 'bg-green-500/20 text-green-500',
  cancelled: 'bg-red-500/20 text-red-500',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  processing: 'Processando',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export default function AdminPedidos() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [zoomedItem, setZoomedItem] = useState<OrderItem | null>(null);
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('orders').update({ status: status as any }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Status atualizado');
    },
  });

  const { data: orderItems = [] } = useQuery({
    queryKey: ['order-items', selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder) return [];
      const { data } = await supabase.from('order_items').select('*').eq('order_id', selectedOrder.id);
      return data || [];
    },
    enabled: !!selectedOrder,
  });

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <CRUDModule<Order>
          title="Pedidos"
          tableName="orders"
          queryKey="admin-orders"
          searchPlaceholder="Buscar por número do pedido..."
          searchFields={['order_number']}
          hideAddButton
          initialData={{}}
          columns={[
            { header: 'Número', key: 'order_number', render: (val) => <span className="font-mono font-bold">{val}</span> },
            { 
              header: 'Origem', 
              key: 'source',
              render: (val) => (
                <Badge className={val === 'pdv' ? 'bg-orange-500/20 text-orange-500' : 'bg-blue-500/20 text-blue-500'}>
                  {val === 'pdv' ? <><Store className="h-3 w-3 mr-1" /> Loja</> : <><Globe className="h-3 w-3 mr-1" /> Site</>}
                </Badge>
              )
            },
            { 
              header: 'Data', 
              key: 'created_at',
              render: (val) => format(new Date(val), 'dd/MM/yy HH:mm', { locale: ptBR })
            },
            { header: 'Total', key: 'total', render: (val) => <span className="font-bold text-primary">{formatCurrency(Number(val))}</span> },
            { 
              header: 'Status', 
              key: 'status',
              render: (val, item) => (
                <Select 
                  value={val} 
                  onValueChange={(status) => updateStatusMutation.mutate({ id: item.id, status })}
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue>
                      <Badge className={statusColors[val] || 'bg-muted'}>
                        {statusLabels[val] || val}
                      </Badge>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Constants.public.Enums.order_status.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {statusLabels[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            },
          ]}
          customActions={(item) => (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => { setSelectedOrder(item); setIsDetailsOpen(true); }}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Imprimir Recibo">
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          )}
        />

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Pedido {selectedOrder?.order_number}</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-muted-foreground">Data</p>
                    <p className="font-bold">{format(new Date(selectedOrder.created_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-bold text-primary text-lg">{formatCurrency(Number(selectedOrder.total))}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2"><Package className="h-4 w-4" /> Itens</h3>
                  <div className="border rounded-lg divide-y">
                    {orderItems.map((item) => (
                      <div key={item.id} className="p-3 flex gap-3">
                        {item.product_image ? (
                          <img 
                            src={item.product_image} 
                            className="w-12 h-12 object-contain bg-white rounded border cursor-pointer hover:opacity-80 transition-opacity" 
                            onClick={() => setZoomedItem(item)}
                          />
                        ) : (
                          <div className="w-12 h-12 bg-white rounded border flex items-center justify-center"><Package className="h-6 w-6 text-muted-foreground" /></div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.product_name}</p>
                          
                          {item.engraving_file_url && (
                            <div className="mt-1 p-1.5 bg-blue-500/10 border border-blue-500/20 rounded">
                              <p className="text-[9px] text-blue-600 uppercase font-bold">Arquivo Anexo (Logo/Arte):</p>
                              <a 
                                href={item.engraving_file_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] text-blue-700 hover:underline flex items-center gap-1 mt-0.5"
                              >
                                <Globe className="h-2.5 w-2.5" /> Abrir Arquivo Original
                              </a>
                            </div>
                          )}

                          <p className="text-[10px] text-muted-foreground mt-1">{item.quantity}x {formatCurrency(Number(item.unit_price))}</p>
                        </div>
                        <p className="font-bold text-sm">{formatCurrency(Number(item.total_price))}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedOrder.shipping_address && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Entrega</h3>
                    <div className="text-sm p-3 border rounded-lg">
                      <p><strong>{(selectedOrder.shipping_address as any).name}</strong></p>
                      <p>{(selectedOrder.shipping_address as any).street}, {(selectedOrder.shipping_address as any).number}</p>
                      <p>{(selectedOrder.shipping_address as any).city} - {(selectedOrder.shipping_address as any).state}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!zoomedItem} onOpenChange={() => setZoomedItem(null)}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white">
            <DialogHeader className="p-4 border-b">
              <DialogTitle>Visualização da Imagem e Detalhes da Gravação</DialogTitle>
            </DialogHeader>
            <div className="p-6 bg-white space-y-4">
              <div className="flex items-center justify-center bg-white border rounded-xl overflow-hidden">
                {zoomedItem && (
                  <img 
                    src={zoomedItem.engraving_preview_url || zoomedItem.product_image || ''} 
                    alt="Zoom" 
                    className="max-w-full max-h-[60vh] object-contain" 
                  />
                )}
              </div>
              
              {zoomedItem && (zoomedItem.engraving_text || zoomedItem.engraving_file_url) && (
                <div className="p-4 bg-muted/30 rounded-lg border space-y-3 text-foreground">
                  {zoomedItem.engraving_text && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Texto para Gravação:</p>
                      <p className="text-lg font-bold text-primary">"{zoomedItem.engraving_text}"</p>
                    </div>
                  )}
                  {zoomedItem.engraving_file_url && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Arquivo Original (Arte/Logo):</p>
                      <a 
                        href={zoomedItem.engraving_file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline mt-1 font-medium"
                      >
                        <Globe className="h-4 w-4" /> Abrir arquivo original em alta resolução
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
