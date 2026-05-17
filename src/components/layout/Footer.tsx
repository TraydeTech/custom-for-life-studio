import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, MessageCircle, Mail, MapPin } from 'lucide-react';
import logoImage from '@/assets/logo-custom-forlife.png';

export function Footer() {
  return (
    <footer className="bg-muted/50 border-t">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo e Descrição */}
          <div className="space-y-4">
            <div className="inline-block bg-[#FFFFFF] rounded-2xl p-4 shadow-sm border border-border/50">
              <img src={logoImage} alt="Custom For Life" className="h-16 w-auto" />
            </div>
            <p className="text-sm text-muted-foreground">
              Transformamos ideias em brindes únicos. Personalização de qualidade para 
              empresas e eventos.
            </p>
            <div className="flex gap-4">
              <a 
                href="https://www.instagram.com/custom_forlife/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a 
                href={`https://wa.me/5511993439999?text=${encodeURIComponent('Olá! Vim pelo site e gostaria de solicitar um orçamento de brindes personalizados.')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Links Rápidos */}
          <div>
            <h3 className="font-semibold mb-4">Loja</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/loja" className="text-muted-foreground hover:text-primary transition-colors">
                  Todos os Produtos
                </Link>
              </li>
              <li>
                <Link to="/loja?categoria=copos-garrafas" className="text-muted-foreground hover:text-primary transition-colors">
                  Copos e Garrafas
                </Link>
              </li>
              <li>
                <Link to="/loja?categoria=camisetas" className="text-muted-foreground hover:text-primary transition-colors">
                  Camisetas
                </Link>
              </li>
              <li>
                <Link to="/loja?categoria=kits-corporativos" className="text-muted-foreground hover:text-primary transition-colors">
                  Kits Corporativos
                </Link>
              </li>
            </ul>
          </div>

          {/* Minha Conta */}
          <div>
            <h3 className="font-semibold mb-4">Minha Conta</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/minha-conta" className="text-muted-foreground hover:text-primary transition-colors">
                  Meus Dados
                </Link>
              </li>
              <li>
                <Link to="/minha-conta/pedidos" className="text-muted-foreground hover:text-primary transition-colors">
                  Meus Pedidos
                </Link>
              </li>
              <li>
                <Link to="/minha-conta/enderecos" className="text-muted-foreground hover:text-primary transition-colors">
                  Endereços
                </Link>
              </li>
              <li>
                <Link to="/carrinho" className="text-muted-foreground hover:text-primary transition-colors">
                  Carrinho
                </Link>
              </li>
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h3 className="font-semibold mb-4">Contato</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                <span>contato@customforlife.com.br</span>
              </li>
              <li className="flex items-start gap-2 text-muted-foreground">
                <MessageCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>(11) 99343-9999</span>
              </li>
              <li className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span>São Paulo, SP</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Custom For Life. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
