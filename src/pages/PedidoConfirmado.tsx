import { Link, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, ShoppingBag, MessageCircle } from 'lucide-react';

export default function PedidoConfirmado() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('pedido') || '';

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container py-12 flex items-center justify-center">
        <Card className="max-w-lg w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-6">
            <div className="flex justify-center">
              <CheckCircle className="h-20 w-20 text-primary" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Pedido recebido com sucesso!</h1>
              {orderNumber && (
                <p className="text-lg text-muted-foreground">
                  Pedido <span className="font-mono font-bold text-foreground">{orderNumber}</span>
                </p>
              )}
            </div>

            <p className="text-muted-foreground">
              Entraremos em contato em breve pelo WhatsApp para confirmar o pagamento e a produção da sua gravação personalizada.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link to="/loja">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  <ShoppingBag className="h-4 w-4" />
                  Continuar Comprando
                </Button>
              </Link>
              <Link to="/minha-conta/pedidos">
                <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
                  Meus Pedidos
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
