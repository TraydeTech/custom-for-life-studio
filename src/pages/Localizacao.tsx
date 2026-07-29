import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SEOMeta } from '@/components/SEOMeta';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, MessageCircle } from 'lucide-react';
import {
  STORE_ADDRESS,
  STORE_MAPS_EMBED,
  STORE_MAPS_DIRECTIONS,
  WHATSAPP_NUMBER,
} from '@/lib/store-config';

export default function Localizacao() {
  return (
    <div className="min-h-screen flex flex-col">
      <SEOMeta
        title="Onde estamos — Localização da loja"
        description="Encontre a Custom For Life em Blumenau/SC. Veja o mapa e trace a rota de como chegar até a loja."
      />
      <Header />

      <main className="flex-1 container py-8 max-w-4xl">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>Início</span>
          <span className="mx-2">/</span>
          <span>Onde estamos</span>
        </nav>
        <h1 className="text-3xl font-bold mb-2">Onde estamos</h1>

        <div className="flex items-start gap-2 text-muted-foreground mb-6">
          <MapPin className="h-5 w-5 mt-0.5 text-primary shrink-0" />
          <p className="text-base">{STORE_ADDRESS}</p>
        </div>

        {/* Mapa */}
        <div className="rounded-2xl overflow-hidden border shadow-sm">
          <iframe
            title="Mapa da loja"
            src={STORE_MAPS_EMBED}
            width="100%"
            height="420"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Button size="lg" className="gap-2" asChild>
            <a href={STORE_MAPS_DIRECTIONS} target="_blank" rel="noopener noreferrer">
              <Navigation className="h-5 w-5" /> Como chegar
            </a>
          </Button>
          <Button size="lg" variant="outline" className="gap-2" asChild>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá! Quero mais informações sobre a loja e a localização.')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-5 w-5" /> Falar no WhatsApp
            </a>
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
