import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { Zap } from 'lucide-react';

const MAX_INSTALLMENTS = 12;

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_price: number | null;
  images: string[];
  is_featured: boolean;
  stock: number;
  category?: {
    name: string;
    slug: string;
  } | null;
}

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const hasDiscount = product.compare_price && product.compare_price > product.price;
  const discountPercentage = hasDiscount
    ? Math.round((1 - product.price / product.compare_price!) * 100)
    : 0;
  const installmentValue = product.price / MAX_INSTALLMENTS;
  const isLowStock = product.stock > 0 && product.stock <= 5;

  const imageUrl = product.images?.[0] || '/placeholder.svg';

  return (
    <Link to={`/produto/${product.slug}`}>
      <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 border hover:border-primary/30 h-full flex flex-col">
        <div className="relative aspect-square overflow-hidden bg-white">
          <img
            src={imageUrl}
            alt={product.name}
            width={400}
            height={400}
            className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          {product.is_featured && (
            <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">
              Destaque
            </Badge>
          )}
          {hasDiscount && (
            <Badge variant="destructive" className="absolute top-2 right-2">
              -{discountPercentage}%
            </Badge>
          )}
          {product.stock === 0 && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <Badge variant="secondary">Esgotado</Badge>
            </div>
          )}
          {isLowStock && (
            <div className="absolute bottom-2 left-2">
              <Badge className="bg-orange-500 text-white text-xs gap-1">
                <Zap className="h-3 w-3" />
                Últimas unidades
              </Badge>
            </div>
          )}
        </div>
        <CardContent className="p-4 flex flex-col flex-1">
          {product.category && (
            <p className="text-xs text-muted-foreground mb-1">
              {product.category.name}
            </p>
          )}
          <h3 className="font-medium line-clamp-2 group-hover:text-primary transition-colors flex-1">
            {product.name}
          </h3>
          {(product.name.toLowerCase().includes('copo') && product.name.includes('1200')) && (
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1 italic">
              Copo personalizado de alta capacidade para eventos, empresas e presentes especiais.
            </p>
          )}
          {(product.name.toLowerCase().includes('garrafa') && product.name.includes('1L')) && (
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1 italic">
              Garrafa térmica premium com personalização para valorizar sua marca no dia a dia.
            </p>
          )}
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-primary">
                {formatCurrency(product.price)}
              </span>
              {hasDiscount && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatCurrency(product.compare_price!)}
                </span>
              )}
            </div>
            {product.price >= 30 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                ou {MAX_INSTALLMENTS}x de {formatCurrency(installmentValue)} sem juros
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
