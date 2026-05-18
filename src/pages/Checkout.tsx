import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { generatePixPayload } from '@/lib/pix';
import {
  ChevronLeft, ChevronRight, MapPin, User, CreditCard, Loader2,
  QrCode, Lock, Copy, CheckCircle, Clock, Banknote
} from 'lucide-react';
import { toast } from 'sonner';
import { maskCPF, unmaskCPF, isValidCPF } from '@/lib/cpf';
import { buildInstallmentOptions } from '@/lib/installments';

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
    zip_code: '', street: '', number: '', complement: '',
    neighborhood: '', city: '', state: '',
  });

  const [showAuthModal, setShowAuthModal] = useState(!user);

  // Payment state
  const [paymentTab, setPaymentTab] = useState('pix');
  const [isGeneratingPayment, setIsGeneratingPayment] = useState(false);
  const [pixData, setPixData] = useState<{ qrCodeText: string; orderNumber: string } | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Card state (disabled for now)
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [installments, setInstallments] = useState('1');

  const checkIntervalRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  // Carrega Iugu.js corretamente via DOM (script tag em JSX não executa)
  useEffect(() => {
    if ((window as any).Iugu) return;
    const script = document.createElement('script');
    script.src = 'https://js.iugu.com/v2';
    script.async = true;
    document.head.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  // Prefill from profile
  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, cpf')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile) {
        setCustomer(prev => ({
          ...prev,
          name: profile.full_name || prev.name,
          phone: profile.phone || prev.phone,
          cpf: profile.cpf || prev.cpf,
        }));
      }
      const { data: addr } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();
      if (addr) {
        setAddress({
          zip_code: addr.zip_code || '', street: addr.street || '',
          number: addr.number || '', complement: addr.complement || '',
          neighborhood: addr.neighborhood || '', city: addr.city || '',
          state: addr.state || '',
        });
      }
    };
    loadProfile();
  }, [user]);

  // Cleanup intervals
  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // PIX timer
  useEffect(() => {
    if (!pixData) return;
    timerRef.current = window.setInterval(() => {
      setPixTimer(prev => {
        if (prev <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [pixData]);

  // We allow visitors to proceed, but they'll see the auth modal if they aren't logged in when finishing
  const isGuest = !user;

  if (cartItems.length === 0 && !orderId) {
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
      } else toast.error('CEP não encontrado');
    } catch { toast.error('Erro ao buscar CEP'); }
    finally { setIsFetchingCep(false); }
  };

  const canProceedStep1 =
    customer.name.trim() &&
    customer.email.trim() &&
    customer.phone.trim() &&
    isValidCPF(customer.cpf);
  const canProceedStep2 = address.zip_code.trim() && address.street.trim() && address.number.trim() && address.neighborhood.trim() && address.city.trim() && address.state.trim();

  const formatCardNumber = (v: string) => v.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').slice(0, 19);
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, '');
    if (d.length >= 2) return `${d.slice(0, 2)}/${d.slice(2, 4)}`;
    return d;
  };

  const createOrder = async () => {
    const shippingAddress = {
      name: customer.name, phone: customer.phone,
      street: address.street, number: address.number,
      complement: address.complement, neighborhood: address.neighborhood,
      city: address.city, state: address.state, zip_code: address.zip_code,
    };

    // order_number é gerado automaticamente pelo trigger BEFORE INSERT
    // (public.generate_order_number). Enviamos placeholder apenas para
    // satisfazer NOT NULL — o banco sobrescreve com o número definitivo.
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        subtotal: cartTotal, total: cartTotal,
        shipping_address: shippingAddress,
        status: 'pending', payment_status: 'pending',
        notes: `Cliente: ${customer.name} | Tel: ${customer.phone} | CPF: ${customer.cpf || 'N/A'}`,
        order_number: 'temp', source: 'site',
      } as any)
      .select()
      .single();

    if (orderError) throw orderError;
    if (!order?.order_number || order.order_number === 'temp' || order.order_number.startsWith('temp')) {
      console.error('[Checkout] order_number não foi gerado pelo backend:', order);
      throw new Error('Não foi possível gerar o número do pedido. Tente novamente em instantes.');
    }

    for (const item of cartItems) {
      let engravingPreviewUrl: string | null = null;
      if (item.engraving_preview_image?.startsWith('data:')) {
        try {
          const base64Data = item.engraving_preview_image.split(',')[1];
          const byteArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const fileName = `engraving-previews/${order.id}/${item.id}-${Date.now()}.png`;
          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, byteArray, { contentType: 'image/png' });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
            engravingPreviewUrl = urlData.publicUrl;
          }
        } catch (e) { console.error('Upload failed:', e); }
      }

      await supabase.from('order_items').insert({
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
    }

    setOrderId(order.id);
    return order;
  };

  const handlePixPayment = async () => {
    setIsGeneratingPayment(true);
    try {
      if (!user) {
        setShowAuthModal(true);
        return;
      }
      const order = orderId ? { id: orderId } : await createOrder();
      const orderNumber = (order as any).order_number;

      // Chave PIX informada: 008.697.879-93
      const pixKey = '008.697.879-93';
      const payload = generatePixPayload(
        pixKey,
        'Custom For Life',
        'TIMBO',
        cartTotal,
        orderNumber
      );

      setPixData({
        qrCodeText: payload,
        orderNumber: orderNumber,
      });

      // Clear cart after generating PIX to prevent double orders
      await clearCart.mutateAsync();
      
      toast.success('Pedido criado! Realize o pagamento via PIX para processarmos seu pedido.');
    } catch (error: any) {
      console.error('PIX error:', error);
      toast.error(error.message || 'Erro ao gerar PIX');
    } finally {
      setIsGeneratingPayment(false);
    }
  };

  const handleFinishOrder = () => {
    if (pixData) {
      navigate(`/pedido-confirmado?pedido=${pixData.orderNumber}`);
    }
  };

  const handleCardPayment = async (type: 'credit_card' | 'debit_card') => {
    if (!cardNumber || !cardName || !cardExpiry || !cardCvv) {
      toast.error('Preencha todos os dados do cartão');
      return;
    }

    setIsSubmitting(true);
    try {
      // Se for convidado, abre o modal de auth antes de criar o pedido
      if (!user) {
        setShowAuthModal(true);
        return;
      }
      const order = orderId ? { id: orderId } : await createOrder();

      // Tokenize via Iugu.js (loaded via script tag)
      const Iugu = (window as any).Iugu;
      if (!Iugu) {
        toast.error('Sistema de pagamento não carregado. Recarregue a página.');
        return;
      }

      const [expMonth, expYear] = cardExpiry.split('/');
      const tokenData = await new Promise<any>((resolve, reject) => {
        Iugu.createPaymentToken({
          number: cardNumber.replace(/\s/g, ''),
          verification_value: cardCvv,
          first_name: cardName.split(' ')[0],
          last_name: cardName.split(' ').slice(1).join(' ') || '',
          month: expMonth,
          year: `20${expYear}`,
        }, (response: any) => {
          if (response.errors) reject(new Error('Dados do cartão inválidos'));
          else resolve(response);
        });
      });

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          orderId: order.id,
          paymentMethod: type,
          token: tokenData.id,
          installments: type === 'credit_card' ? parseInt(installments) : 1,
          customerName: customer.name,
          customerEmail: customer.email,
          customerCpf: unmaskCPF(customer.cpf),
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.message || data.error);

      await clearCart.mutateAsync();
      toast.success('Pagamento aprovado!');
      navigate(`/pedido-confirmado?pedido=${(order as any).order_number || ''}`);
    } catch (error: any) {
      console.error('Card error:', error);
      toast.error(error.message || 'Cartão recusado. Verifique os dados ou tente outro cartão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPixCode = () => {
    if (pixData?.qrCodeText) {
      navigator.clipboard.writeText(pixData.qrCodeText);
      toast.success('Código PIX copiado!');
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const installmentOptions = buildInstallmentOptions(cartTotal);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      <main className="flex-1 container py-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Finalizar Compra</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[
            { n: 1, label: 'Dados', icon: User },
            { n: 2, label: 'Endereço', icon: MapPin },
            { n: 3, label: 'Pagamento', icon: CreditCard },
          ].map(({ n, label }) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {n}
              </div>
              <span className={`text-sm hidden sm:inline ${step >= n ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
              {n < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step 1 — Customer Data */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Dados do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div><Label htmlFor="name">Nome completo *</Label><Input id="name" value={customer.name} onChange={e => setCustomer(prev => ({ ...prev, name: e.target.value }))} placeholder="Seu nome completo" /></div>
              <div><Label htmlFor="email">E-mail *</Label><Input id="email" type="email" value={customer.email} onChange={e => setCustomer(prev => ({ ...prev, email: e.target.value }))} placeholder="seu@email.com" /></div>
              <div><Label htmlFor="phone">WhatsApp / Telefone *</Label><Input id="phone" value={customer.phone} onChange={e => setCustomer(prev => ({ ...prev, phone: e.target.value }))} placeholder="(11) 99999-9999" /></div>
              <div>
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={customer.cpf}
                  onChange={e => setCustomer(prev => ({ ...prev, cpf: maskCPF(e.target.value) }))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  maxLength={14}
                />
                {customer.cpf.length > 0 && unmaskCPF(customer.cpf).length === 11 && !isValidCPF(customer.cpf) && (
                  <p className="text-sm text-destructive mt-1">CPF inválido. Verifique os dígitos.</p>
                )}
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>Próximo<ChevronRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — Address */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Endereço de Entrega</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1"><Label htmlFor="cep">CEP *</Label><Input id="cep" value={address.zip_code} onChange={e => setAddress(prev => ({ ...prev, zip_code: e.target.value }))} onBlur={handleCepBlur} placeholder="00000-000" maxLength={9} /></div>
                {isFetchingCep && <Loader2 className="h-5 w-5 animate-spin mt-8" />}
              </div>
              <div><Label htmlFor="street">Rua *</Label><Input id="street" value={address.street} onChange={e => setAddress(prev => ({ ...prev, street: e.target.value }))} placeholder="Rua, Avenida..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="number">Número *</Label><Input id="number" value={address.number} onChange={e => setAddress(prev => ({ ...prev, number: e.target.value }))} placeholder="123" /></div>
                <div><Label htmlFor="complement">Complemento</Label><Input id="complement" value={address.complement} onChange={e => setAddress(prev => ({ ...prev, complement: e.target.value }))} placeholder="Apto, bloco..." /></div>
              </div>
              <div><Label htmlFor="neighborhood">Bairro *</Label><Input id="neighborhood" value={address.neighborhood} onChange={e => setAddress(prev => ({ ...prev, neighborhood: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2"><Label htmlFor="city">Cidade *</Label><Input id="city" value={address.city} onChange={e => setAddress(prev => ({ ...prev, city: e.target.value }))} /></div>
                <div><Label htmlFor="state">Estado *</Label><Input id="state" value={address.state} onChange={e => setAddress(prev => ({ ...prev, state: e.target.value }))} maxLength={2} placeholder="SP" /></div>
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="mr-2 h-4 w-4" />Voltar</Button>
                <Button onClick={() => setStep(3)} disabled={!canProceedStep2}>Próximo<ChevronRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 — Payment */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Order Summary */}
            <Card>
              <CardHeader><CardTitle>Resumo do Pedido</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-3 pb-3 border-b last:border-0">
                    <img src={item.engraving_preview_image || item.product?.images?.[0] || '/placeholder.svg'} alt={item.product?.name} className="w-16 h-16 object-contain rounded-lg" loading="lazy" width={64} height={64} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.product?.name}{item.product_color && ` — ${item.product_color}`}</p>
                      {item.engraving_text && <p className="text-xs text-muted-foreground">Gravação: "{item.engraving_text}"</p>}
                      <p className="text-sm mt-1">{item.quantity}x {formatCurrency(item.product?.price || 0)} = {formatCurrency((item.product?.price || 0) * item.quantity)}</p>
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

            {/* Delivery Info */}
            <Card>
              <CardHeader><CardTitle>Dados da Entrega</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>{customer.name}</strong></p>
                <p>{customer.email} | {customer.phone}</p>
                <p>{address.street}, {address.number}{address.complement ? ` - ${address.complement}` : ''}</p>
                <p>{address.neighborhood}, {address.city}/{address.state} - CEP: {address.zip_code}</p>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />Pagamento
                </CardTitle>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Lock className="h-3 w-3" />
                  Pagamento seguro — seus dados são criptografados
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={paymentTab} onValueChange={setPaymentTab}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="pix" className="gap-2"><QrCode className="h-4 w-4" />PIX</TabsTrigger>
                    <TabsTrigger value="credit" className="gap-2"><CreditCard className="h-4 w-4" />Crédito</TabsTrigger>
                    <TabsTrigger value="debit" className="gap-2"><Banknote className="h-4 w-4" />Débito</TabsTrigger>
                  </TabsList>

                  {/* PIX Tab */}
                  <TabsContent value="pix" className="space-y-4 pt-4">
                    {!pixData ? (
                      <div className="text-center space-y-4">
                        <QrCode className="h-16 w-16 mx-auto text-primary" />
                        <p className="text-muted-foreground">Gere o QR Code PIX para pagamento instantâneo</p>
                        <Button size="lg" onClick={handlePixPayment} disabled={isGeneratingPayment} className="gap-2">
                          {isGeneratingPayment ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando...</> : <><QrCode className="h-5 w-5" />Gerar PIX — {formatCurrency(cartTotal)}</>}
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center space-y-4">
                        <div className="bg-white p-4 rounded-lg inline-block">
                          <QRCodeSVG value={pixData.qrCodeText} size={192} />
                        </div>
                        <div className="flex items-center gap-2 justify-center">
                          <Clock className="h-4 w-4 text-amber-500" />
                          <span className="text-amber-500 font-mono font-bold">{formatTime(pixTimer)}</span>
                          <span className="text-xs text-muted-foreground">para expirar</span>
                        </div>
                        <div className="bg-muted p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-2">Código PIX copia e cola:</p>
                          <div className="flex gap-2">
                            <Input value={pixData.qrCodeText} readOnly className="text-xs font-mono" />
                            <Button variant="outline" size="icon" onClick={copyPixCode}><Copy className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 justify-center text-primary">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Aguardando confirmação do pagamento PIX...</span>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Credit Card Tab */}
                  <TabsContent value="credit" className="space-y-4 pt-4">
                    <CardForm
                      cardNumber={cardNumber} setCardNumber={setCardNumber}
                      cardName={cardName} setCardName={setCardName}
                      cardExpiry={cardExpiry} setCardExpiry={setCardExpiry}
                      cardCvv={cardCvv} setCardCvv={setCardCvv}
                      formatCardNumber={formatCardNumber} formatExpiry={formatExpiry}
                      isCredit
                      installments={installments} setInstallments={setInstallments}
                      installmentOptions={installmentOptions}
                      isSubmitting={isSubmitting}
                      onSubmit={() => handleCardPayment('credit_card')}
                      total={cartTotal}
                    />
                  </TabsContent>

                  {/* Debit Card Tab */}
                  <TabsContent value="debit" className="space-y-4 pt-4">
                    <CardForm
                      cardNumber={cardNumber} setCardNumber={setCardNumber}
                      cardName={cardName} setCardName={setCardName}
                      cardExpiry={cardExpiry} setCardExpiry={setCardExpiry}
                      cardCvv={cardCvv} setCardCvv={setCardCvv}
                      formatCardNumber={formatCardNumber} formatExpiry={formatExpiry}
                      isCredit={false}
                      installments={installments} setInstallments={setInstallments}
                      installmentOptions={installmentOptions}
                      isSubmitting={isSubmitting}
                      onSubmit={() => handleCardPayment('debit_card')}
                      total={cartTotal}
                    />
                  </TabsContent>
                </Tabs>

                <div className="flex justify-start mt-6">
                  <Button variant="outline" onClick={() => setStep(2)}><ChevronLeft className="mr-2 h-4 w-4" />Voltar</Button>
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

interface CardFormProps {
  cardNumber: string; setCardNumber: (v: string) => void;
  cardName: string; setCardName: (v: string) => void;
  cardExpiry: string; setCardExpiry: (v: string) => void;
  cardCvv: string; setCardCvv: (v: string) => void;
  formatCardNumber: (v: string) => string;
  formatExpiry: (v: string) => string;
  isCredit: boolean;
  installments: string; setInstallments: (v: string) => void;
  installmentOptions: { value: string; label: string }[];
  isSubmitting: boolean;
  onSubmit: () => void;
  total: number;
}

function CardForm({
  cardNumber, setCardNumber, cardName, setCardName,
  cardExpiry, setCardExpiry, cardCvv, setCardCvv,
  formatCardNumber, formatExpiry, isCredit,
  installments, setInstallments, installmentOptions,
  isSubmitting, onSubmit, total,
}: CardFormProps) {
  return (
    <>
      <div><Label>Número do cartão</Label><Input value={cardNumber} onChange={e => setCardNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" maxLength={19} /></div>
      <div><Label>Nome impresso no cartão</Label><Input value={cardName} onChange={e => setCardName(e.target.value.toUpperCase())} placeholder="NOME COMO NO CARTÃO" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Validade</Label><Input value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/AA" maxLength={5} /></div>
        <div><Label>CVV</Label><Input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="000" maxLength={4} type="password" /></div>
      </div>
      {isCredit && (
        <div><Label>Parcelas</Label>
          <Select value={installments} onValueChange={setInstallments}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {installmentOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button size="lg" className="w-full gap-2" onClick={onSubmit} disabled={isSubmitting}>
        {isSubmitting
          ? <><Loader2 className="h-4 w-4 animate-spin" />Processando...</>
          : <><Lock className="h-4 w-4" />Pagar {formatCurrency(total)}{!isCredit ? ' no débito' : ''}</>
        }
      </Button>
    </>
  );
}
