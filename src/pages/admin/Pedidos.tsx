import { useState } from 'react';
import { CRUDModule } from '@/components/admin/CRUDModule';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Tables, Constants } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { ShoppingBag, Eye, Printer, Globe, Store, Package, Download, FileImage } from 'lucide-react';
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
                      <div key={item.id} className="p-3 flex gap-4 items-start bg-muted/20 rounded-lg mb-2">
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
                          <p className="font-medium text-sm truncate">{item.product_name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.quantity}x {formatCurrency(Number(item.unit_price))}</p>
                          {item.engraving_text && (
                            <p className="text-xs text-primary font-medium mt-1">Texto: "{item.engraving_text}"</p>
                          )}
                        </div>
                        <p className="font-bold text-sm pt-1">{formatCurrency(Number(item.total_price))}</p>
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
          <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white border-none shadow-2xl [&>button]:text-slate-900 [&>button]:opacity-100 [&>button:hover]:bg-slate-100">
            <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
              <DialogTitle className="text-lg">
                {zoomedImageType === 'preview' ? 'Prévia do Produto' : 'Arquivo Original do Cliente'}
              </DialogTitle>
            </DialogHeader>
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
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Item Selecionado</p>
                    <p className="font-semibold text-slate-900">{zoomedItem?.product_name}</p>
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
