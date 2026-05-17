import React from "react";
import { Link } from "react-router-dom";
import { MessageCircle, ShoppingBag, Star, CheckCircle2, Award, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImage from "@/assets/logo-custom-forlife.png";

interface ModernHeroProps {
  title: React.ReactNode;
  subtitle: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary: { label: string; href: string };
  image: string;
}

export const ModernHero: React.FC<ModernHeroProps> = ({
  title,
  subtitle,
  ctaPrimary,
  ctaSecondary,
  image,
}) => {
  return (
    <section className="relative min-h-[90vh] flex items-center pt-20 pb-16 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 bg-background">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 blur-[120px] rounded-full animate-pulse" />
      </div>

      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Text Content */}
          <div className="flex-1 text-center lg:text-left z-10">
            <div className="flex flex-col items-center lg:items-start mb-6 animate-fade-in">
              <div className="bg-[#FFFFFF] p-3 rounded-xl mb-6 shadow-sm inline-block">
                <img src={logoImage} alt="Custom For Life" className="h-10 w-auto" />
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
                <Star className="w-4 h-4 fill-primary" />
                <span>Brindes Premium para Empresas e Eventos</span>
              </div>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-heading font-bold mb-6 leading-[1.1] animate-fade-in-up">
              {title}
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              {subtitle}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <Button size="xl" className="bg-gradient-brand hover:scale-105 transition-all shadow-lg shadow-primary/20 rounded-full h-14 px-8 text-lg" asChild>
                <a href={ctaPrimary.href} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  {ctaPrimary.label}
                </a>
              </Button>
              
              <Button size="xl" variant="outline" className="border-2 border-primary/50 hover:bg-primary/5 rounded-full h-14 px-8 text-lg" asChild>
                <Link to={ctaSecondary.href}>
                  <ShoppingBag className="w-5 h-5 mr-2" />
                  {ctaSecondary.label}
                </Link>
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="mt-12 pt-12 border-t border-border/50 flex flex-wrap justify-center lg:justify-start gap-8 opacity-70">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Qualidade Premium</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Líder no Segmento</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">500+ Marcas Atendidas</span>
              </div>
            </div>
          </div>

          {/* Image Side */}
          <div className="flex-1 relative animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="relative z-10 gradient-border p-1.5 rounded-[2.5rem] bg-white shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-700 overflow-hidden group">
              <img
                src={image}
                alt="Produtos Personalizados Premium"
                className="rounded-[2.2rem] w-full aspect-[4/5] lg:aspect-square object-cover group-hover:scale-105 transition-transform duration-700"
              />
              
              {/* Floating Element 1 */}
              <div className="absolute -top-6 -right-6 bg-card/90 backdrop-blur border border-border p-4 rounded-2xl shadow-xl animate-bounce-slow">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    <Star className="w-5 h-5 text-primary fill-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Nota 5.0</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avaliação Clientes</p>
                  </div>
                </div>
              </div>

              {/* Floating Element 2 */}
              <div className="absolute -bottom-6 -left-6 bg-card/90 backdrop-blur border border-border p-4 rounded-2xl shadow-xl animate-float">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary/20 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Envio Rápido</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Todo o Brasil</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Background Glow behind image */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 bg-gradient-to-tr from-primary/30 to-secondary/30 blur-[80px] opacity-30 rounded-full" />
          </div>
        </div>
      </div>
    </section>
  );
};
