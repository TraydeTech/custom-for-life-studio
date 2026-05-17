import React from "react";
import { ShieldCheck, Zap, Truck, CreditCard } from "lucide-react";

export const FeatureStrip = () => {
  const features = [
    {
      icon: ShieldCheck,
      title: "Qualidade Garantida",
      description: "Acabamento premium em cada detalhe."
    },
    {
      icon: Zap,
      title: "Atendimento Rápido",
      description: "Suporte via WhatsApp em minutos."
    },
    {
      icon: Truck,
      title: "Entrega Segura",
      description: "Enviamos para todo o Brasil."
    },
    {
      icon: CreditCard,
      title: "Pagamento Facilitado",
      description: "Parcelamento em até 12x no cartão."
    }
  ];

  return (
    <div className="bg-card/50 backdrop-blur-sm border-y border-border/50 py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-sm sm:text-base">{feature.title}</h3>
              <p className="text-xs text-muted-foreground hidden sm:block">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
