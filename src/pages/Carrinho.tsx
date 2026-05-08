import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/hooks/useCart';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Minus, Plus, Trash2, ShoppingBag, X, LogIn } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { AuthModal } from '@/components/auth/AuthModal';

export default function Carrinho() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { cartItems, cartTotal, isLoading, updateQuantity, removeFromCart } = useCart();
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

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

  const shippingCost = 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container py-8">
        <h1 className="text-3xl font-bold mb-8">Carrinho de Compras</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Lista de itens */}
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <Link to={`/produto/${item.product?.slug}`} className="shrink-0">
                      {item.engraving_preview_image ? (
                        <img
                          src={item.engraving_preview_image}
                          alt={item.product?.name}
                          className="w-24 h-24 object-contain rounded-lg cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            setZoomedImage(item.engraving_preview_image);
                          }}
                        />
                      ) : (
                        <img
                          src={item.product?.images?.[0] || '/placeholder.svg'}
                          alt={item.product?.name}
                          className="w-24 h-24 object-contain rounded-lg"
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
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
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
                            className="h-8 w-8"
                            onClick={() => updateQuantity.mutate({ 
                              itemId: item.id, 
                              quantity: item.quantity + 1 
                            })}
                            disabled={item.quantity >= (item.product?.stock || 0)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-semibold">
                            {formatCurrency((item.product?.price || 0) * item.quantity)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
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
                  <span>{shippingCost === 0 ? 'Grátis' : formatCurrency(shippingCost)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(cartTotal + shippingCost)}</span>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                {!user && (
                  <p className="text-xs text-muted-foreground text-center w-full">
                    Faça login para finalizar sua compra
                  </p>
                )}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => user ? navigate('/checkout') : setShowAuthModal(true)}
                >
                  {user ? 'Finalizar Compra' : <><LogIn className="mr-2 h-4 w-4" />Entrar e Finalizar</>}
                </Button>
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
            <X className="h-8 w-8" />
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
