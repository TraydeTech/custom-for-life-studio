import { Link } from "react-router-dom";
import { SEOMeta } from "@/components/SEOMeta";
import { Instagram, Sparkles, Gift, Star, ArrowRight, Heart, CheckCircle, Phone, ShoppingBag, Box, MessageSquare, Users, ShieldCheck, MessageCircle } from "lucide-react";
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
import { ArcGalleryHero } from "@/components/ui/arc-gallery-hero";
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
    description: "Copos modernos e funcionais para levar sua marca ao dia a dia dos clientes.",
    image: brindeCopo,
  },
  {
    title: "Camisetas",
    description: "Peças personalizadas para equipes, eventos, ações promocionais e identidade de marca.",
    image: brindeCamiseta,
  },
  {
    title: "Kits Corporativos",
    description: "Combinações completas para presentear clientes, colaboradores e parceiros com mais impacto.",
    image: brindeKit,
  },
  {
    title: "Ecobags",
    description: "Brindes sustentáveis, úteis e com grande área de personalização para sua marca.",
    image: brindeEcobag,
  },
  {
    title: "Cadernos Premium",
    description: "Materiais elegantes para reuniões, eventos, treinamentos e presentes corporativos.",
    image: brindeCaderno,
  },
];

const diferenciais = [
  { 
    icon: Sparkles, 
    title: "Personalização sob medida",
    text: "produtos criados com nome, logo, frase ou identidade da sua marca." 
  },
  { 
    icon: Star, 
    title: "Acabamento premium",
    text: "materiais selecionados e técnicas de personalização com excelente apresentação." 
  },
  { 
    icon: ShieldCheck, 
    title: "Atendimento consultivo",
    text: "ajudamos você a escolher o melhor brinde para sua ação, evento ou presente." 
  },
  { 
    icon: Heart, 
    title: "Experiência memorável",
    text: "brindes úteis, bonitos e pensados para fortalecer conexões." 
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEOMeta
        title="Brindes Personalizados que Valorizam sua Marca"
        description="Brindes personalizados que valorizam sua marca e encantam seus clientes. Copos, garrafas e kits corporativos premium."
      />
      <Header />

      {/* Hero Section - Arc Gallery */}
      <ArcGalleryHero
        images={produtosReais}
        startAngle={25}
        endAngle={155}
        radiusLg={450}
        radiusMd={340}
        radiusSm={240}
        cardSizeLg={110}
        cardSizeMd={90}
        cardSizeSm={70}
        title={
          <>
            Brindes personalizados que <span className="gradient-text">valorizam sua marca</span>
            <br /> e encantam seus clientes
          </>
        }
        subtitle="Criamos copos, garrafas, camisetas e kits corporativos personalizados com acabamento premium, ideais para empresas, eventos, equipes e presentes especiais."
        ctaPrimary={{ label: "💬 Solicitar orçamento pelo WhatsApp", href: `https://wa.me/5511993439999?text=${encodeURIComponent('Olá! Vim pelo site e gostaria de solicitar um orçamento de brindes personalizados.')}` }}
        ctaSecondary={{ label: "🛍️ Ver catálogo de produtos", href: "/loja" }}
      />

      {/* Sobre Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in-up">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold mb-6">
                Somos a <span className="gradient-text">Custom For Life</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Na Custom For Life, cada brinde é criado para representar bem a sua marca. 
                Trabalhamos com produtos selecionados, personalização de qualidade e atendimento 
                próximo para ajudar empresas, eventos e equipes a escolherem brindes úteis, 
                bonitos e memoráveis.
              </p>
              <div className="grid grid-cols-1 gap-6">
                {diferenciais.map((item, index) => (
                  <div
                    key={index}
                    className="flex gap-4 p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.text}</p>
                    </div>
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
                    <p className="font-bold text-lg">Mais de 500</p>
                    <p className="text-sm text-muted-foreground">Projetos personalizados entregues para marcas, eventos e presentes especiais.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como Funciona Section */}
      <section className="py-24 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold mb-4">
              Como funciona a <span className="gradient-text">personalização</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Do primeiro contato até a entrega, acompanhamos cada etapa para que seu brinde fique do jeito certo.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: "1", title: "Escolha o produto", desc: "Selecione copos, garrafas, camisetas, kits ou outros brindes personalizados.", icon: ShoppingBag },
              { step: "2", title: "Envie sua ideia", desc: "Você pode enviar nome, frase, logo ou referência visual para personalização.", icon: MessageSquare },
              { step: "3", title: "Aprove a arte", desc: "Antes da produção, alinhamos os detalhes para garantir um resultado fiel à sua marca.", icon: CheckCircle },
              { step: "4", title: "Receba seu pedido", desc: "Produzimos com cuidado e entregamos seus brindes prontos para surpreender.", icon: Box },
            ].map((item, i) => (
              <div key={i} className="relative group p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all">
                <div className="w-12 h-12 mb-6 bg-gradient-brand rounded-full flex items-center justify-center text-white font-bold text-xl">
                  {item.step}
                </div>
                <h3 className="text-xl font-heading font-bold mb-3">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Para Quem Fazemos Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold mb-4">
              Brindes para <span className="gradient-text">empresas, eventos</span> e momentos especiais
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Criamos produtos personalizados para diferentes objetivos: fortalecer marcas, presentear clientes, valorizar equipes e tornar eventos mais memoráveis.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { title: "Empresas e equipes", desc: "Brindes personalizados para colaboradores, onboarding, ações internas e datas comemorativas.", icon: Users },
              { title: "Eventos e campanhas", desc: "Produtos úteis e marcantes para congressos, feiras, ativações e ações promocionais.", icon: Star },
              { title: "Clientes e parceiros", desc: "Presentes personalizados para fortalecer relacionamentos e gerar lembrança de marca.", icon: Heart },
              { title: "Presentes especiais", desc: "Itens únicos com nome, frase ou arte personalizada para surpreender em qualquer ocasião.", icon: Gift },
            ].map((item, i) => (
              <div key={i} className="flex gap-6 p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all">
                <div className="shrink-0 w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center">
                  <item.icon className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-heading font-bold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
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

      {/* FAQ Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-12 text-center">
              Dúvidas <span className="gradient-text">frequentes</span>
            </h2>
            <div className="space-y-4">
              {[
                { q: "Posso personalizar com minha logo?", a: "Sim. Você pode personalizar com logo, nome, frase ou arte, conforme o produto escolhido e a técnica disponível." },
                { q: "A personalização está incluída no preço?", a: "Em alguns produtos, como gravação a laser, a personalização pode estar incluída. Para pedidos maiores ou técnicas específicas, recomendamos solicitar orçamento." },
                { q: "Vocês atendem empresas e eventos?", a: "Sim. Atendemos empresas, equipes, eventos, campanhas promocionais, presentes corporativos e também pedidos personalizados especiais." },
                { q: "Qual é o prazo de produção?", a: "O prazo pode variar conforme produto, quantidade e tipo de personalização. Informe sua necessidade pelo WhatsApp para receber uma previsão mais precisa." },
                { q: "Existe quantidade mínima?", a: "A quantidade mínima pode variar conforme o produto e a personalização. Consulte pelo WhatsApp para avaliarmos a melhor opção para seu pedido." },
                { q: "Posso ver uma prévia da arte antes da produção?", a: "Sim. Sempre que necessário, alinhamos a arte e os detalhes antes da produção para garantir um resultado adequado à sua marca." },
              ].map((faq, i) => (
                <div key={i} className="p-6 rounded-xl bg-card border border-border">
                  <h3 className="text-lg font-bold mb-2">{faq.q}</h3>
                  <p className="text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Depoimentos Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-heading font-bold mb-12 text-center">
            O que dizem nossos <span className="gradient-text">clientes</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { text: "Produto com acabamento excelente e atendimento muito atencioso.", author: "Cliente Custom For Life" },
              { text: "Os brindes ficaram lindos e representaram muito bem nossa marca.", author: "Cliente corporativo" },
              { text: "Ótima opção para presentear clientes e equipe com algo útil e personalizado.", author: "Cliente Custom For Life" },
            ].map((dep, i) => (
              <div key={i} className="p-8 rounded-2xl bg-card border border-border italic text-center">
                <p className="mb-4">"{dep.text}"</p>
                <cite className="font-bold not-italic text-sm text-primary">— {dep.author}</cite>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Conceito Section */}

      {/* CTA Final */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-brand opacity-20 animate-gradient bg-[length:200%_200%]" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold mb-6">
              Pronto para criar <span className="gradient-text">brindes personalizados</span> para sua marca?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Fale com a Custom For Life e receba orientação para escolher o produto ideal para sua empresa, evento ou presente especial.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="xl" asChild>
                <a href={`https://wa.me/5511993439999?text=${encodeURIComponent('Olá! Vim pelo site e gostaria de solicitar um orçamento de brindes personalizados.')}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-5 h-5" />
                  Solicitar orçamento pelo WhatsApp
                </a>
              </Button>
              <Button variant="heroBorder" size="xl" asChild>
                <Link to="/loja">
                  <ShoppingBag className="w-5 h-5" />
                  Ver catálogo de produtos
                </Link>
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
