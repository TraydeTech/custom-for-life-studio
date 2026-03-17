import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';

import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { ChevronLeft, ChevronRight, MapPin, User, CreditCard, MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CustomerData {
  name: string;
  email: string;
  phone: string;
  cpf: string;
}

interface AddressData {
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cartItems, cartTotal, clearCart } = useCart();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  const [customer, setCustomer] = useState<CustomerData>({
    name: user?.user_metadata?.full_name || '',
    email: user?.email || '',
    phone: '',
    cpf: '',
  });

  const [address, setAddress] = useState<AddressData>({
    zip_code: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
  });

  if (!user) {
    navigate('/login');
    return null;
  }

  if (cartItems.length === 0) {
    navigate('/carrinho');
    return null;
  }

  const handleCepBlur = async () => {
    const cep = address.zip_code.replace(/\D/g, '');
    if (cep.length !== 8) return;

    setIsFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setAddress(prev => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      } else {
        toast.error('CEP não encontrado');
      }
    } catch {
      toast.error('Erro ao buscar CEP');
    } finally {
      setIsFetchingCep(false);
    }
  };

  const canProceedStep1 = customer.name.trim() && customer.email.trim() && customer.phone.trim();
  const canProceedStep2 = address.zip_code.trim() && address.street.trim() && address.number.trim() && address.neighborhood.trim() && address.city.trim() && address.state.trim();

  const handleFinalize = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // 1. Create order
      const shippingAddress = {
        name: customer.name,
        phone: customer.phone,
        street: address.street,
        number: address.number,
        complement: address.complement,
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        zip_code: address.zip_code,
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          subtotal: cartTotal,
          total: cartTotal,
          shipping_address: shippingAddress,
          status: 'pending',
          payment_status: 'pending',
          notes: `Cliente: ${customer.name} | Tel: ${customer.phone} | CPF: ${customer.cpf || 'N/A'}`,
          order_number: 'temp',
          source: 'site',
        } as any)
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Create order items with engraving preview upload
      for (const item of cartItems) {
        let engravingPreviewUrl: string | null = null;

        // Upload engraving preview to storage if exists
        if (item.engraving_preview_image && item.engraving_preview_image.startsWith('data:')) {
          try {
            const base64Data = item.engraving_preview_image.split(',')[1];
            const byteArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const fileName = `engraving-previews/${order.id}/${item.id}-${Date.now()}.png`;

            const { error: uploadError } = await supabase.storage
              .from('product-images')
              .upload(fileName, byteArray, { contentType: 'image/png' });

            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from('product-images')
                .getPublicUrl(fileName);
              engravingPreviewUrl = urlData.publicUrl;
            }
          } catch (e) {
            console.error('Failed to upload engraving preview:', e);
          }
        }

        const { error: itemError } = await supabase
          .from('order_items')
          .insert({
            order_id: order.id,
            product_id: item.product_id,
            product_name: item.product?.name || 'Produto',
            product_image: item.product?.images?.[0] || null,
            quantity: item.quantity,
            unit_price: item.product?.price || 0,
            total_price: (item.product?.price || 0) * item.quantity,
            customization_notes: item.customization_notes,
            engraving_text: item.engraving_text,
            engraving_position_x: item.engraving_position_x,
            engraving_position_y: item.engraving_position_y,
            engraving_preview_url: engravingPreviewUrl,
            product_color: item.product_color,
          });

        if (itemError) throw itemError;
      }

      // 3. Clear cart
      await clearCart.mutateAsync();

      // 4. Build WhatsApp message
      const itemLines = cartItems.map(item => {
        let line = `• ${item.product?.name || 'Produto'}`;
        if (item.product_color) line += ` — ${item.product_color}`;
        if (item.engraving_text) line += ` (Gravação: "${item.engraving_text}")`;
        line += ` | Qtd: ${item.quantity} | ${formatCurrency((item.product?.price || 0) * item.quantity)}`;
        return line;
      }).join('\n');

      const whatsappMsg = encodeURIComponent(
        `Olá! Gostaria de finalizar meu pedido #${order.order_number}:\n\n${itemLines}\n\nTotal: ${formatCurrency(cartTotal)}\n\nNome: ${customer.name}\nTelefone: ${customer.phone}\nEndereço: ${address.street}, ${address.number}${address.complement ? ` - ${address.complement}` : ''}, ${address.neighborhood}, ${address.city}/${address.state} - CEP: ${address.zip_code}`
      );

      // Open WhatsApp
      window.open(`https://wa.me/5511999999999?text=${whatsappMsg}`, '_blank');

      // 5. Navigate to confirmation
      navigate(`/pedido-confirmado?pedido=${order.order_number}`);
    } catch (error: any) {
      console.error('Error finalizing order:', error);
      toast.error('Erro ao finalizar pedido. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container py-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Finalizar Compra</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[
            { n: 1, label: 'Dados', icon: User },
            { n: 2, label: 'Endereço', icon: MapPin },
            { n: 3, label: 'Resumo', icon: CreditCard },
          ].map(({ n, label, icon: Icon }) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step >= n
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {n}
              </div>
              <span className={`text-sm hidden sm:inline ${step >= n ? 'text-foreground' : 'text-muted-foreground'}`}>
                {label}
              </span>
              {n < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step 1 — Customer Data */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Dados do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  value={customer.name}
                  onChange={e => setCustomer(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Seu nome completo"
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={customer.email}
                  onChange={e => setCustomer(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">WhatsApp / Telefone *</Label>
                <Input
                  id="phone"
                  value={customer.phone}
                  onChange={e => setCustomer(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <Label htmlFor="cpf">CPF (opcional)</Label>
                <Input
                  id="cpf"
                  value={customer.cpf}
                  onChange={e => setCustomer(prev => ({ ...prev, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
                  Próximo
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — Address */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Endereço de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="cep">CEP *</Label>
                  <Input
                    id="cep"
                    value={address.zip_code}
                    onChange={e => setAddress(prev => ({ ...prev, zip_code: e.target.value }))}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>
                {isFetchingCep && <Loader2 className="h-5 w-5 animate-spin mt-8" />}
              </div>
              <div>
                <Label htmlFor="street">Rua *</Label>
                <Input
                  id="street"
                  value={address.street}
                  onChange={e => setAddress(prev => ({ ...prev, street: e.target.value }))}
                  placeholder="Rua, Avenida..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="number">Número *</Label>
                  <Input
                    id="number"
                    value={address.number}
                    onChange={e => setAddress(prev => ({ ...prev, number: e.target.value }))}
                    placeholder="123"
                  />
                </div>
                <div>
                  <Label htmlFor="complement">Complemento</Label>
                  <Input
                    id="complement"
                    value={address.complement}
                    onChange={e => setAddress(prev => ({ ...prev, complement: e.target.value }))}
                    placeholder="Apto, bloco..."
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="neighborhood">Bairro *</Label>
                <Input
                  id="neighborhood"
                  value={address.neighborhood}
                  onChange={e => setAddress(prev => ({ ...prev, neighborhood: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="city">Cidade *</Label>
                  <Input
                    id="city"
                    value={address.city}
                    onChange={e => setAddress(prev => ({ ...prev, city: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="state">Estado *</Label>
                  <Input
                    id="state"
                    value={address.state}
                    onChange={e => setAddress(prev => ({ ...prev, state: e.target.value }))}
                    maxLength={2}
                    placeholder="SP"
                  />
                </div>
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button onClick={() => setStep(3)} disabled={!canProceedStep2}>
                  Próximo
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 — Summary & Payment */}
        {step === 3 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-3 pb-3 border-b last:border-0">
                    <img
                      src={item.engraving_preview_image || item.product?.images?.[0] || '/placeholder.svg'}
                      alt={item.product?.name}
                      className="w-16 h-16 object-contain rounded-lg"
                      loading="lazy"
                      width={64}
                      height={64}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {item.product?.name}
                        {item.product_color && ` — ${item.product_color}`}
                      </p>
                      {item.engraving_text && (
                        <p className="text-xs text-muted-foreground">
                          Gravação: "{item.engraving_text}"
                        </p>
                      )}
                      <p className="text-sm mt-1">
                        {item.quantity}x {formatCurrency(item.product?.price || 0)} = {formatCurrency((item.product?.price || 0) * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(cartTotal)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dados da Entrega</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>{customer.name}</strong></p>
                <p>{customer.email} | {customer.phone}</p>
                <p>{address.street}, {address.number}{address.complement ? ` - ${address.complement}` : ''}</p>
                <p>{address.neighborhood}, {address.city}/{address.state} - CEP: {address.zip_code}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Ao finalizar, você será redirecionado para o WhatsApp para confirmar o pagamento com nossa equipe.
                </p>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleFinalize}
                    disabled={isSubmitting}
                    className="gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Finalizando...
                      </>
                    ) : (
                      <>
                        <MessageCircle className="h-5 w-5" />
                        Finalizar e Pagar via WhatsApp
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
