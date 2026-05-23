import { Instagram, MessageCircle, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEOMeta } from "@/components/SEOMeta";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import logoImage from "@/assets/logo-custom-forlife.png";

export default function ComingSoon() {
  return (
    <>
      <SEOMeta
        title="Em breve | Custom For Life"
        description="Estamos preparando algo especial para você. Nosso site estará disponível em breve."
      />
      <BackgroundGradientAnimation
        gradientBackgroundStart="rgb(20, 10, 40)"
        gradientBackgroundEnd="rgb(10, 5, 20)"
        firstColor="251, 146, 60"
        secondColor="236, 72, 153"
        thirdColor="168, 85, 247"
        fourthColor="244, 114, 182"
        fifthColor="251, 191, 36"
        pointerColor="251, 146, 60"
      >
        <main className="absolute inset-0 z-10 flex items-center justify-center px-4 py-12 overflow-y-auto">
          <div className="container max-w-3xl mx-auto text-center animate-fade-in">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <div className="bg-white p-5 rounded-2xl shadow-xl inline-block">
                <img src={logoImage} alt="Custom For Life" className="h-32 md:h-36 w-auto" />
              </div>
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              <span>Algo especial está chegando</span>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-heading font-bold mb-6 leading-tight text-white drop-shadow-lg">
              Nosso site estará{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                pronto em breve
              </span>
            </h1>

            {/* Description */}
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed drop-shadow">
              Estamos finalizando os últimos detalhes para oferecer a melhor experiência em
              brindes personalizados premium. Enquanto isso, fale conosco diretamente pelo
              WhatsApp ou acompanhe nossas novidades no Instagram.
            </p>

            {/* Status indicator */}
            <div className="inline-flex items-center gap-2 text-white/70 mb-10">
              <Clock className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm">Trabalhando para você</span>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="xl" variant="hero" className="rounded-full h-14 px-8 text-lg" asChild>
                <a
                  href={`https://wa.me/5547984492949?text=${encodeURIComponent('Olá! Vim pelo site e gostaria de saber mais sobre os brindes personalizados.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Falar no WhatsApp
                </a>
              </Button>

              <Button size="xl" variant="hero" className="rounded-full h-14 px-8 text-lg" asChild>
                <a
                  href="https://instagram.com/custom_forlife"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Instagram className="w-5 h-5 mr-2" />
                  @custom_forlife
                </a>
              </Button>
            </div>

            {/* Footer note */}
            <p className="mt-16 text-xs text-white/60">
              © {new Date().getFullYear()} Custom For Life — Brindes personalizados premium
            </p>
          </div>
        </main>
      </BackgroundGradientAnimation>
    </>
  );
}
