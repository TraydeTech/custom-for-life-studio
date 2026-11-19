import React, { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/hooks/useCart';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Minus, Plus, Trash2, ShoppingBag, X, LogIn, MessageCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { AuthModal } from '@/components/auth/AuthModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { canUseMercadoPago, PAYMENT_ENABLED, buildWhatsAppOrderLink } from '@/lib/store-config';

export default function Carrinho() {
  const { user, isAdmin } = useAuth();
  const mercadoPagoEnabled = canUseMercadoPago(isAdmin);
  const navigate = useNavigate();
  const { cartItems, cartTotal, isLoading, updateQuantity, removeFromCart } = useCart();
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [searchParams] = useSearchParams();
  const [isTestingPayment, setIsTestingPayment] = useState(false);
  const testAttempt = useRef<string>();
  const returnedFromTest = searchParams.get('mercado-pago-teste') === 'retorno';
  const testOrderId = returnedFromTest
    ? searchParams.get('order_id') || sessionStorage.getItem('mercado-pago-test-order')
    : null;

  const testMercadoPago = async (id?: string) => {
    setIsTestingPayment(true);
    try {
      testAttempt.current ??= crypto.randomUUID();
      const { data, error } = await supabase.functions.invoke('mercado-pago-test', {
        body: id ? { action: 'status', id } : { action: 'create', attempt: testAttempt.current },
      });
      if (error) {
        const response = error.context;
        const body = response instanceof Response ? await response.json().catch(() => null) : null;
        throw new Error(body?.error || 'Não foi possível acessar o teste do Mercado Pago.');
      }
      if (id) {
        toast.info(`Mercado Pago informou: ${data.status} (${data.detail}).`);
      } else {
        sessionStorage.setItem('mercado-pago-test-order', data.id);
        window.location.assign(data.checkoutUrl);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha no teste do Mercado Pago.');
    } finally {
      setIsTestingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </main>
        <Footer />
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="text-center space-y-4">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground" />
            <h1 className="text-2xl font-bold">Seu carrinho está vazio</h1>
            <p className="text-muted-foreground">
              Explore nossa loja e adicione produtos ao carrinho.
            </p>
            <Link to="/loja">
              <Button>Ver Produtos</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }


  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container py-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Carrinho de Compras</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Lista de itens */}
          <div className="min-w-0 lg:col-span-2 space-y-4">
            {cartItems.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex gap-3 sm:gap-4">
                    <Link to={`/produto/${item.product?.slug}`} className="shrink-0">
                      {item.engraving_preview_image ? (
                        <img
                          src={item.engraving_preview_image}
                          alt={item.product?.name}
                          className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-lg cursor-pointer bg-[#FFFFFF]"
                          onClick={(e) => {
                            e.preventDefault();
                            setZoomedImage(item.engraving_preview_image);
                          }}
                        />
                      ) : (
                        <img
                          src={item.product?.images?.[0] || '/placeholder.svg'}
                          alt={item.product?.name}
                          className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-lg bg-[#FFFFFF]"
                        />
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link 
                        to={`/produto/${item.product?.slug}`}
                        className="font-medium hover:text-primary line-clamp-2"
                      >
                        {item.product?.name}
                      </Link>
                      {item.product_color && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Cor: <span className="text-foreground">{item.product_color}</span>
                        </p>
                      )}
                      {item.engraving_text && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Gravação: <span className="text-foreground font-medium">{item.engraving_text}</span>
                          {' — '}
                          <span className="text-xs">Posição: personalizada</span>
                        </p>
                      )}
                      {!item.engraving_text && item.customization_notes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Gravação: {item.customization_notes}
                        </p>
                      )}
                      {item.engraving_file_url && (
                        <a href={item.engraving_file_url} target="_blank" rel="noopener noreferrer"
                          className="mt-2 inline-block text-sm text-primary underline">Ver arte anexada</a>
                      )}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10"
                            disabled={updateQuantity.isPending || removeFromCart.isPending}
                            aria-label={`Diminuir quantidade de ${item.product?.name}`}
                            onClick={() => updateQuantity.mutate({ 
                              itemId: item.id, 
                              quantity: item.quantity - 1 
                            })}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => updateQuantity.mutate({ 
                              itemId: item.id, 
                              quantity: item.quantity + 1 
                            })}
                            aria-label={`Aumentar quantidade de ${item.product?.name}`}
                            disabled={updateQuantity.isPending || removeFromCart.isPending || item.quantity >= (item.product?.stock || 0)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-4">
                          <span className="font-semibold whitespace-nowrap">
                            {formatCurrency((item.product?.price || 0) * item.quantity)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            aria-label={`Remover ${item.product?.name} do carrinho`}
                            disabled={removeFromCart.isPending || updateQuantity.isPending}
                            onClick={() => removeFromCart.mutate(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Resumo do pedido */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(cartTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frete</span>
                  <span>A combinar</span>
                </div>
                <p className="text-xs text-muted-foreground">Entrega grátis para Blumenau. Para outras cidades, confirme o frete antes de fechar o pedido.</p>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total dos produtos</span>
                  <span>{formatCurrency(cartTotal)}</span>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                {isAdmin && (
                  <div className="w-full space-y-2 border-b pb-3">
                    <p className="text-xs text-muted-foreground">Teste do Mercado Pago disponível para administradores.</p>
                    {testOrderId && (
                      <Button className="w-full" variant="outline" disabled={isTestingPayment} onClick={() => testMercadoPago(testOrderId)}>
                        Consultar resultado do teste
                      </Button>
                    )}
                    <Button className="w-full" variant="outline" disabled={isTestingPayment} onClick={() => testMercadoPago()}>
                      {isTestingPayment ? 'Aguarde…' : 'Testar pagamento no Mercado Pago'}
                    </Button>
                  </div>
                )}
                {!user && (
                  <p className="w-full text-center text-xs text-muted-foreground">
                    Entre ou crie uma conta para continuar.
                  </p>
                )}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => user ? navigate('/checkout') : setShowAuthModal(true)}
                >
                  {user ? 'Finalizar compra' : <><LogIn className="mr-2 h-4 w-4" />Entrar ou criar conta</>}
                </Button>
                {!PAYMENT_ENABLED && !mercadoPagoEnabled && (
                  <Button className="w-full" size="lg" variant="outline" asChild>
                    <a
                      href={buildWhatsAppOrderLink(cartItems, cartTotal)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Pedir pelo WhatsApp
                    </a>
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </main>

      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onSuccess={() => navigate('/checkout')}
      />

      {/* Zoom modal for engraving preview */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white z-50"
            onClick={() => setZoomedImage(null)}
          >
            <X className="h-10 w-10" />
          </button>
          <img
            src={zoomedImage}
            alt="Prévia da gravação"
            className="max-w-[90vw] max-h-[90vh] object-contain"
          />
        </div>
      )}

      <Footer />
    </div>
  );
}
