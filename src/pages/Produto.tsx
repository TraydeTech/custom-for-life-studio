import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { ShoppingCart, Minus, Plus, ChevronRight, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ProductImageCanvas, ProductImageCanvasRef } from '@/components/shop/ProductImageCanvas';

interface ProductVariant {
  id: string;
  product_id: string;
  color_name: string;
  main_image: string | null;
  additional_images: string[];
  sort_order: number;
}

export default function Produto() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const canvasRef = useRef<ProductImageCanvasRef>(null);
  const [selected, setSelected] = useState<ProductVariant | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [customizationNotes, setCustomizationNotes] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);
  const [engravingPosX, setEngravingPosX] = useState(50);
  const [engravingPosY, setEngravingPosY] = useState(72);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, category:categories(name, slug, technical_sheet)')
        .eq('slug', slug!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: variants = [] } = useQuery({
    queryKey: ['product-variants', product?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('product_variants')
        .select('*')
        .eq('product_id', product!.id)
        .order('sort_order');
      if (error) throw error;
      return data as ProductVariant[];
    },
    enabled: !!product?.id,
  });

  useEffect(() => {
    if (!variants.length) return;
    const stillExists = selected && variants.some((v) => v.id === selected.id);
    if (!selected || !stillExists) {
      setSelected(variants[0]);
    }
  }, [variants]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <Skeleton className="aspect-square rounded-xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-8 text-center">
          <h1 className="text-2xl font-bold">Produto não encontrado</h1>
          <Link to="/loja">
            <Button className="mt-4">Voltar à Loja</Button>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const hasVariants = variants.length > 0;

  const getAllImages = (): string[] => {
    if (selected) {
      const imgs: string[] = [];
      if (selected.main_image) imgs.push(selected.main_image);
      if (selected.additional_images) imgs.push(...selected.additional_images);
      return imgs;
    }
    return product.images || [];
  };

  const images = getAllImages();
  const mainImage = images[selectedImageIndex] || '/placeholder.svg';

  const hasDiscount = product.compare_price && product.compare_price > product.price;
  const discountPercentage = hasDiscount
    ? Math.round((1 - product.price / product.compare_price!) * 100)
    : 0;

  const isOutOfStock = (product.stock ?? 0) <= 0;

  const handleAddToCart = () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }

    const engravingText = customizationNotes.trim() || undefined;
    let engravingPreviewImage: string | undefined;

    if (engravingText && canvasRef.current) {
      engravingPreviewImage = canvasRef.current.getDataURL() || undefined;
    }

    addToCart.mutate({
      productId: product.id,
      quantity,
      customizationNotes: customizationNotes || undefined,
      engravingText,
      engravingPositionX: engravingText ? Math.round(engravingPosX * 100) / 100 : undefined,
      engravingPositionY: engravingText ? Math.round(engravingPosY * 100) / 100 : undefined,
      engravingPreviewImage,
      productColor: selected?.color_name || undefined,
    });
  };

  const handleVariantSelect = (variant: ProductVariant) => {
    setSelected(variant);
    setSelectedImageIndex(0);
  };

  const handleThumbnailClick = (imgIndex: number) => {
    setSelectedImageIndex(imgIndex);
  };

  const handlePositionChange = (x: number, y: number) => {
    setEngravingPosX(x);
    setEngravingPosY(y);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-1">
          <Link to="/" className="hover:text-primary">Início</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/loja" className="hover:text-primary">Loja</Link>
          {product.category && (
            <>
              <ChevronRight className="h-3 w-3" />
              <Link to={`/loja?categoria=${product.category.slug}`} className="hover:text-primary">
                {product.category.name}
              </Link>
            </>
          )}
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div
              className="relative aspect-square rounded-xl overflow-hidden"
              style={{ backgroundColor: '#D9D9D9' }}
            >
              <ProductImageCanvas
                ref={canvasRef}
                imageSrc={mainImage}
                altText={product.name}
                customizationText={customizationNotes}
                onClick={() => setIsZoomed(true)}
                positionX={engravingPosX}
                positionY={engravingPosY}
                onPositionChange={handlePositionChange}
              />
              {product.is_featured && (
                <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
                  Destaque
                </Badge>
              )}
              {hasDiscount && (
                <Badge variant="destructive" className="absolute top-3 right-3">
                  -{discountPercentage}%
                </Badge>
              )}
              {isOutOfStock && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                  <Badge variant="secondary" className="text-lg px-4 py-2">Esgotado</Badge>
                </div>
              )}
            </div>

            {/* Fullscreen zoom modal */}
            {isZoomed && (
              <div
                className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-zoom-out"
                onClick={() => setIsZoomed(false)}
              >
                <button
                  className="absolute top-4 right-4 text-white/70 hover:text-white z-50"
                  onClick={() => setIsZoomed(false)}
                >
                  <X className="h-8 w-8" />
                </button>
                <img
                  src={mainImage}
                  alt={product.name}
                  className="max-w-[90vw] max-h-[90vh] object-contain"
                />
              </div>
            )}

            {/* Image thumbnails for current variant */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleThumbnailClick(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      idx === selectedImageIndex
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-transparent hover:border-muted-foreground/30'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}

            {/* Color variant thumbnails */}
            {hasVariants && variants.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 pl-3 mt-6 pt-2">
                {variants.map((variant) => {
                  const isSelected = variant.id === selected?.id;
                  const thumbImg = variant.main_image || '/placeholder.svg';
                  return (
                    <button
                      key={variant.id}
                      onClick={() => handleVariantSelect(variant)}
                      className="flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer group"
                    >
                      <div
                        className={`w-[70px] h-[70px] rounded-lg overflow-hidden transition-all ${
                          isSelected
                            ? 'border-2 scale-[1.08]'
                            : 'border-[1.5px] border-white/15 group-hover:opacity-85'
                        }`}
                        style={isSelected ? { borderColor: '#EF9F27' } : undefined}
                      >
                        <img src={thumbImg} alt={variant.color_name} className="w-full h-full object-contain" />
                      </div>
                      <span
                        className={`text-[11px] text-center leading-tight ${
                          isSelected ? 'font-medium' : 'text-white/70'
                        }`}
                        style={isSelected ? { color: '#EF9F27' } : undefined}
                      >
                        {variant.color_name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {product.category && (
              <Link
                to={`/loja?categoria=${product.category.slug}`}
                className="text-sm text-primary font-medium hover:underline"
              >
                {product.category.name}
              </Link>
            )}

            <h1 className="text-3xl font-bold">{product.name}</h1>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-primary">
                {formatCurrency(product.price)}
              </span>
              {hasDiscount && (
                <span className="text-lg text-muted-foreground line-through">
                  {formatCurrency(product.compare_price!)}
                </span>
              )}
            </div>

            {/* Color Selector */}
            {hasVariants && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Cor: <span className="text-primary">{currentVariant?.color_name}</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {variants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => handleVariantSelect(variant)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                        variant.id === currentVariant?.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 text-foreground'
                      }`}
                    >
                      {variant.color_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="prose prose-sm max-w-none text-muted-foreground">
                <p className="whitespace-pre-line">{product.description}</p>
              </div>
            )}

            {/* Customization */}
            <div className="space-y-2">
              <Label htmlFor="customization" className="text-sm font-medium">
                Personalize sua garrafa — gravação a laser incluída no preço
              </Label>
              <Textarea
                id="customization"
                value={customizationNotes}
                onChange={(e) => setCustomizationNotes(e.target.value)}
                placeholder="Digite o nome ou texto que deseja gravar..."
                rows={3}
                disabled={isOutOfStock}
              />
            </div>

            {/* Quantity + Add to cart */}
            <div className="flex items-center gap-4">
              <div className="flex items-center border rounded-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={isOutOfStock}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(Math.min(product.stock || 99, quantity + 1))}
                  disabled={isOutOfStock}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Button
                size="lg"
                className="flex-1"
                onClick={handleAddToCart}
                disabled={isOutOfStock || addToCart.isPending}
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                {isOutOfStock ? 'Esgotado' : 'Adicionar ao Carrinho'}
              </Button>
            </div>

            {/* Stock info */}
            {!isOutOfStock && product.stock && product.stock <= 10 && (
              <p className="text-sm text-secondary font-medium">
                ⚡ Apenas {product.stock} unidades em estoque!
              </p>
            )}
          </div>
        </div>

        {/* Ficha Técnica */}
        {product.category?.technical_sheet && Array.isArray(product.category.technical_sheet) && product.category.technical_sheet.length > 0 && (
          <div className="mt-12 border-t pt-8">
            <h2 className="text-2xl font-bold mb-6">📋 Ficha Técnica</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(product.category.technical_sheet as { title: string; items: { label: string; value: string }[] }[]).map((section: { title: string; items: { label: string; value: string }[] }, sIdx: number) => (
                <div key={sIdx} className="border rounded-lg p-4 bg-card">
                  <h3 className="font-semibold text-primary mb-3">{section.title}</h3>
                  <div className="space-y-2">
                    {section.items.map((item: { label: string; value: string }, iIdx: number) => (
                      <div key={iIdx} className="flex justify-between gap-4 text-sm">
                        <span className="text-muted-foreground font-medium">{item.label}</span>
                        <span className="text-right">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
