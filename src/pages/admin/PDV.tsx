import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  CreditCard,
  Banknote,
  QrCode,
  Check,
  X,
  Package
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'>;

interface CartItem {
  product: Product;
  quantity: number;
}

export default function AdminPDV() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ['pdv-products'],
    staleTime: 1000 * 60 * 2, // Cache por 2 minutos
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .gt('stock', 0)
        .order('name');
      if (error) throw error;
      return data as Product[];
    },
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!search.trim()) return products;
    const searchLower = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(searchLower) ||
        p.slug.toLowerCase().includes(searchLower)
    );
  }, [products, search]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error('Estoque insuficiente');
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty > item.product.stock) {
            toast.error('Estoque insuficiente');
            return item;
          }
          return { ...item, quantity: newQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCustomerName('');
    setAmountReceived(0);
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const total = Math.max(0, subtotal - discount);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const handleCheckout = async () => {
    if (!paymentMethod) {
      toast.error('Selecione a forma de pagamento');
      return;
    }

    setIsProcessing(true);

    try {
      // Create order - order_number will be overwritten by trigger
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          order_number: 'TEMP', // Will be replaced by trigger
          status: 'delivered' as const,
          payment_status: 'paid' as const,
          subtotal,
          discount,
          total,
          shipping_cost: 0,
          shipping_address: {
            street: 'Venda Loja Física',
            number: '-',
            neighborhood: '-',
            city: '-',
            state: '-',
            zip_code: '-',
          },
          payment_method: paymentMethod,
          notes: customerName ? `Cliente: ${customerName}` : 'Venda PDV - Loja Física',
          delivered_at: new Date().toISOString(),
          source: 'pdv',
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cart.map((item) => ({
        order_id: order.id,
        product_id: item.product.id,
        product_name: item.product.name,
        product_image: item.product.images?.[0] || null,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Stock is automatically updated by database trigger

      toast.success(`Venda finalizada! Pedido ${order.order_number}`);
      
      // Reset
      clearCart();
      setPaymentMethod('');
      setAmountReceived(0);
      setIsCheckoutOpen(false);
      
      // Refresh products to update stock
      queryClient.invalidateQueries({ queryKey: ['pdv-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });

    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Erro ao finalizar venda: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="h-[calc(100vh-2rem)] flex flex-col">
          <div className="mb-4">
            <h1 className="text-3xl font-heading font-bold">PDV - Ponto de Venda</h1>
            <p className="text-muted-foreground">Venda produtos na loja física</p>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
            {/* Products Panel */}
            <div className="lg:col-span-2 flex flex-col min-h-0">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto por nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
                {isLoading ? (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    Carregando produtos...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado
                  </div>
                ) : (
                  filteredProducts.map((product) => {
                    const isLowStock = product.stock <= 5;
                    
                    return (
                      <Card
                        key={product.id}
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => addToCart(product)}
                      >
                        <CardContent className="p-3">
                          <div className="aspect-square rounded-md overflow-hidden bg-white mb-2 border">
                            <img
                              src={product.images?.[0] || '/placeholder.svg'}
                              alt={product.name}
                              className="w-full h-full object-contain cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomedImage(product.images?.[0] || '/placeholder.svg');
                              }}
                            />
                          </div>
                          <h3 className="font-medium text-sm line-clamp-2 mb-1">
                            {product.name}
                          </h3>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-primary">
                              {formatCurrency(product.price)}
                            </span>
                            <Badge 
                              variant={isLowStock ? 'outline' : 'secondary'} 
                              className={`text-xs flex items-center gap-1 ${isLowStock ? 'border-amber-500 text-amber-600 dark:text-amber-400' : ''}`}
                            >
                              <Package className="h-3 w-3" />
                              {product.stock} un
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>

            {/* Cart Panel */}
            <Card className="flex flex-col min-h-0">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Carrinho
                  {cart.length > 0 && (
                    <Badge variant="secondary">{cart.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col min-h-0">
                {cart.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    Carrinho vazio
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                      {cart.map((item) => (
                        <div
                          key={item.product.id}
                          className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"
                        >
                          <img
                            src={item.product.images?.[0] || '/placeholder.svg'}
                            alt={item.product.name}
                            className="w-12 h-12 object-contain bg-white rounded border cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setZoomedImage(item.product.images?.[0] || '/placeholder.svg')}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {item.product.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(item.product.price)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.product.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.product.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Separator className="mb-4" />

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Desconto</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={discount || ''}
                          onChange={(e) => setDiscount(Number(e.target.value))}
                          className="h-8 w-24 text-sm"
                          placeholder="0,00"
                        />
                      </div>
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span className="text-primary">{formatCurrency(total)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={clearCart}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Limpar
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => setIsCheckoutOpen(true)}
                        disabled={cart.length === 0}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Finalizar
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

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

        {/* Checkout Dialog */}
        <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
          <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Finalizar Venda</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Nome do Cliente (opcional)
                </label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Forma de Pagamento *
                </label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a forma de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4" />
                        Dinheiro
                      </div>
                    </SelectItem>
                    <SelectItem value="cartao_credito">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Cartão de Crédito
                      </div>
                    </SelectItem>
                    <SelectItem value="cartao_debito">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Cartão de Débito
                      </div>
                    </SelectItem>
                    <SelectItem value="pix">
                      <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4" />
                        PIX
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cash change calculator */}
              {paymentMethod === 'dinheiro' && (
                <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Valor Recebido
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        R$
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amountReceived || ''}
                        onChange={(e) => setAmountReceived(Number(e.target.value))}
                        className="pl-10"
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  {amountReceived > 0 && (
                    <div className={`flex justify-between items-center p-3 rounded-lg ${
                      amountReceived >= total 
                        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' 
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      <span className="font-medium">
                        {amountReceived >= total ? 'Troco' : 'Falta'}
                      </span>
                      <span className="text-lg font-bold">
                        {formatCurrency(Math.abs(amountReceived - total))}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Itens</span>
                  <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                    <span>Desconto</span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCheckoutOpen(false)}
                disabled={isProcessing}
              >
                Cancelar
              </Button>
              <Button onClick={handleCheckout} disabled={isProcessing}>
                {isProcessing ? 'Processando...' : 'Confirmar Venda'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
