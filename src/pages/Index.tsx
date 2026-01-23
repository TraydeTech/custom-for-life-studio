import { Link } from "react-router-dom";
import { Instagram, Sparkles, Gift, Star, ArrowRight, Heart, CheckCircle, Phone, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import heroImage from "@/assets/hero-brindes-novo.png";
import brindeCopo from "@/assets/brinde-copo.jpg";
import brindeCamiseta from "@/assets/brinde-camiseta.jpg";
import brindeKit from "@/assets/brinde-kit.jpg";
import brindeEcobag from "@/assets/brinde-ecobag.jpg";
import brindeCaderno from "@/assets/brinde-caderno.jpg";

// Imagens de produtos reais
import produtoCanecaSandra from "@/assets/produto-caneca-sandra.png";
import produtoCopoMarca from "@/assets/produto-copo-marca.png";
import produtoStanleyVermelho from "@/assets/produto-stanley-vermelho.png";
import produtoCopoAzul from "@/assets/produto-copo-azul.png";
import produtoStanleyHope from "@/assets/produto-stanley-hope.png";
import produtoConjuntoCafe from "@/assets/produto-conjunto-cafe.png";
import produtoCoposCores from "@/assets/produto-copos-cores.png";
import produtoChurrasco from "@/assets/produto-churrasco.png";
import produtoChinelo from "@/assets/produto-chinelo.png";

const produtosReais = [
  produtoCanecaSandra,
  produtoCopoMarca,
  produtoStanleyVermelho,
  produtoCopoAzul,
  produtoStanleyHope,
  produtoConjuntoCafe,
  produtoCoposCores,
  produtoChurrasco,
  produtoChinelo,
];
const brindes = [
  {
    title: "Copos Personalizados",
    description: "Térmicos e elegantes, perfeitos para qualquer ocasião",
    image: brindeCopo,
  },
  {
    title: "Camisetas",
    description: "Estampas exclusivas que vestem sua marca com estilo",
    image: brindeCamiseta,
  },
  {
    title: "Kits Corporativos",
    description: "Conjuntos completos para impressionar clientes e equipes",
    image: brindeKit,
  },
  {
    title: "Ecobags",
    description: "Sustentáveis e práticas, com a cara da sua marca",
    image: brindeEcobag,
  },
  {
    title: "Cadernos Premium",
    description: "Materiais nobres para presentear com sofisticação",
    image: brindeCaderno,
  },
];

const diferenciais = [
  { icon: Sparkles, text: "Personalização única" },
  { icon: Star, text: "Qualidade premium" },
  { icon: Gift, text: "Experiências memoráveis" },
  { icon: Heart, text: "Atendimento exclusivo" },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
        </div>
        <div className="relative z-10 container mx-auto px-4 text-center">
          <div className="animate-fade-in-up">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-sm text-muted-foreground mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              Brindes que criam conexões
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-heading font-bold mb-6 leading-tight">
              Sua marca <span className="gradient-text">ganha vida</span>
              <br /> em cada detalhe
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Transformamos ideias em brindes únicos. Personalizados com qualidade premium 
              para fortalecer sua marca e criar experiências inesquecíveis.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="xl" asChild>
                <Link to="/loja">
                  <ShoppingBag className="w-5 h-5" />
                  Ver Produtos
                </Link>
              </Button>
              <Button variant="heroBorder" size="xl" asChild>
                <a href="https://www.instagram.com/custom_forlife/" target="_blank" rel="noopener noreferrer">
                  <Instagram className="w-5 h-5" />
                  Veja nossos projetos
                </a>
              </Button>
            </div>
          </div>
        </div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-float">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-primary rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Sobre Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in-up">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold mb-6">
                Somos a <span className="gradient-text">Custom For Life</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Cada brinde que criamos é uma extensão da sua marca. Trabalhamos com os melhores 
                materiais e técnicas de personalização para entregar produtos que impressionam 
                e fortalecem conexões.
              </p>
              <p className="text-lg text-muted-foreground mb-8">
                De copos térmicos a kits corporativos completos, nossa missão é transformar 
                suas ideias em brindes que contam histórias e geram impacto.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {diferenciais.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors"
                  >
                    <item.icon className="w-5 h-5 text-primary" />
                    <span className="font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="gradient-border p-1 rounded-2xl">
                <img
                  src={heroImage}
                  alt="Brindes Custom For Life"
                  className="rounded-xl w-full aspect-video object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -right-6 bg-card border border-border rounded-lg p-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-brand rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold">+500</p>
                    <p className="text-sm text-muted-foreground">Projetos entregues</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Galeria de Produtos Reais */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-sm text-muted-foreground mb-4">
              <Star className="w-4 h-4 text-primary" />
              Nossos Trabalhos
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold mb-4">
              Projetos <span className="gradient-text">Realizados</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Veja alguns dos brindes personalizados que já criamos para nossos clientes
            </p>
          </div>
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-2 md:-ml-4">
              {produtosReais.map((produto, index) => (
                <CarouselItem key={index} className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3">
                  <div className="gradient-border overflow-hidden rounded-2xl">
                    <img
                      src={produto}
                      alt={`Produto personalizado ${index + 1}`}
                      className="w-full aspect-square object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex -left-4" />
            <CarouselNext className="hidden md:flex -right-4" />
          </Carousel>
        </div>
      </section>

      {/* Brindes em Destaque */}
      <section id="brindes" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-sm text-muted-foreground mb-4">
              <Gift className="w-4 h-4 text-secondary" />
              Portfólio
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold mb-4">
              Brindes em <span className="gradient-text">Destaque</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Cada categoria pensada para criar experiências únicas e fortalecer sua marca
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {brindes.map((brinde, index) => (
              <div
                key={index}
                className="group gradient-border overflow-hidden cursor-pointer"
              >
                <div className="relative aspect-square overflow-hidden">
                  <img
                    src={brinde.image}
                    alt={brinde.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="p-6 bg-card">
                  <h3 className="text-xl font-heading font-bold mb-2">{brinde.title}</h3>
                  <p className="text-muted-foreground">{brinde.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Instagram Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-brand opacity-10" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-brand rounded-2xl flex items-center justify-center animate-pulse-glow">
              <Instagram className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold mb-4">
              Nosso Instagram é nossa <span className="gradient-text">vitrine</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Acompanhe nossos projetos, novidades e bastidores. Cada post é uma amostra 
              do que podemos criar para sua marca.
            </p>
            <Button variant="hero" size="xl" asChild>
              <a href="https://www.instagram.com/custom_forlife/" target="_blank" rel="noopener noreferrer">
                <Instagram className="w-5 h-5" />
                Siga @custom_forlife
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Conceito Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-heading font-bold mb-8 leading-tight">
              Mais que brindes,{" "}
              <span className="gradient-text">criamos experiências</span>{" "}
              que conectam pessoas e marcas
            </h2>
            <p className="text-xl text-muted-foreground mb-12">
              Cada projeto é uma oportunidade de transformar o comum em extraordinário. 
              Personalizamos com paixão, entregamos com excelência.
            </p>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:-translate-y-2">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Star className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-2">Qualidade Premium</h3>
                <p className="text-muted-foreground">Materiais selecionados e acabamento impecável</p>
              </div>
              <div className="p-8 rounded-2xl bg-card border border-border hover:border-secondary/50 transition-all duration-300 hover:-translate-y-2">
                <div className="w-16 h-16 mx-auto mb-4 bg-secondary/20 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-secondary" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-2">100% Personalizado</h3>
                <p className="text-muted-foreground">Cada detalhe pensado para sua marca</p>
              </div>
              <div className="p-8 rounded-2xl bg-card border border-border hover:border-accent/50 transition-all duration-300 hover:-translate-y-2">
                <div className="w-16 h-16 mx-auto mb-4 bg-accent/20 rounded-xl flex items-center justify-center">
                  <Heart className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-2">Feito com Amor</h3>
                <p className="text-muted-foreground">Dedicação em cada etapa do processo</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-brand opacity-20 animate-gradient bg-[length:200%_200%]" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold mb-6">
              Pronto para criar <span className="gradient-text">brindes únicos</span>?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Entre em contato agora e transforme sua ideia em realidade. 
              Orçamento rápido pelo WhatsApp ou Instagram.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="xl" asChild>
                <Link to="/loja">
                  <ShoppingBag className="w-5 h-5" />
                  Ver Catálogo de Produtos
                </Link>
              </Button>
              <Button variant="heroBorder" size="xl" asChild>
                <a href="https://www.instagram.com/custom_forlife/" target="_blank" rel="noopener noreferrer">
                  <Instagram className="w-5 h-5" />
                  Fale pelo Instagram
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
