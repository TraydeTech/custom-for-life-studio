import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { ShoppingCart, Minus, Plus, ChevronRight, X, Hand, Truck, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AuthModal } from '@/components/auth/AuthModal';
import { ProductCard } from '@/components/shop/ProductCard';
import { SEOMeta } from '@/components/SEOMeta';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Image cache — persists across variant switches for instant swaps
  const imageCache = useRef<Record<string, HTMLImageElement>>({});

  // Single state for selected variant — controls everything
  const [selected, setSelected] = useState<ProductVariant | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [engravingText, setEngravingText] = useState('');
  const [addedToCart, setAddedToCart] = useState(false);
  const [debouncedEngravingText, setDebouncedEngravingText] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);
  const [engravingPosX, setEngravingPosX] = useState(50);
  const [engravingPosY, setEngravingPosY] = useState(72);
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculador de frete
  const [cepInput, setCepInput] = useState('');
  const [shippingResult, setShippingResult] = useState<string | null>(null);
  const [fetchingCep, setFetchingCep] = useState(false);

  // Fetch product + variants in a single query
  const { data: productData, isLoading } = useQuery({
    queryKey: ['product-with-variants', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, category:categories(name, slug, technical_sheet), product_variants(*)')
        .eq('slug', slug!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const product = productData ?? null;

  // Produtos relacionados: mesma categoria, excluindo o atual
  const { data: relatedProducts = [] } = useQuery({
    queryKey: ['related-products', product?.category_id, product?.id],
    queryFn: async () => {
      if (!product?.category_id) return [];
      const { data } = await supabase
        .from('products')
        .select('id, name, slug, price, compare_price, images, is_featured, stock, category:categories(name,slug)')
        .eq('is_active', true)
        .eq('category_id', product.category_id)
        .neq('id', product.id)
        .gt('stock', 0)
        .limit(4);
      return (data || []) as any[];
    },
    enabled: !!product?.category_id,
    staleTime: 1000 * 60 * 5,
  });

  const variants: ProductVariant[] = (productData as any)?.product_variants
    ? [...(productData as any).product_variants].sort((a: ProductVariant, b: ProductVariant) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    : [];

  // Set initial selected variant
  useEffect(() => {
    if (variants.length > 0 && !selected) {
      setSelected(variants[0]);
    }
  }, [variants]);

  // Preload all variant images in background for instant switching
  useEffect(() => {
    variants.forEach((v) => {
      const url = v.main_image;
      if (url && !imageCache.current[url]) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.onload = () => { imageCache.current[url] = img; };
      }
      // Also preload additional images
      v.additional_images?.forEach((additionalUrl) => {
        if (additionalUrl && !imageCache.current[additionalUrl]) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = additionalUrl;
          img.onload = () => { imageCache.current[additionalUrl] = img; };
        }
      });
    });
  }, [variants]);

  // Debounce engraving text for canvas rendering
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedEngravingText(engravingText);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [engravingText]);

  // Get all images for the currently selected variant
  const getImages = (): string[] => {
    if (selected) {
      const imgs: string[] = [];
      if (selected.main_image) imgs.push(selected.main_image);
      if (selected.additional_images) imgs.push(...selected.additional_images);
      return imgs;
    }
    return product?.images || [];
  };

  const images = selected || product ? getImages() : [];
  const mainImage = images[selectedImageIndex] || '/placeholder.svg';

  // Draw text helper (reusable)
  const drawText = useCallback((ctx: CanvasRenderingContext2D, size: number, text: string) => {
    if (!text.trim()) return;
    const fontSize = Math.max(24, size * 0.045);
    ctx.save();
    ctx.font = `600 ${fontSize}px "Inter", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textX = (engravingPosX / 100) * size;
    const textY = (engravingPosY / 100) * size;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(text, textX, textY);
    ctx.restore();
  }, [engravingPosX, engravingPosY]);

  // Draw canvas with image cache
  const drawCanvas = useCallback((url: string, text: string) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 800;
    canvas.width = size;
    canvas.height = size;

    const renderImage = (img: HTMLImageElement) => {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);

      const imgAspect = img.width / img.height;
      const fillRatio = 1.0; // Use 100% of canvas
      let drawW: number, drawH: number;
      // Fit entire image inside canvas (object-contain behavior)
      if (imgAspect > 1) {
        drawW = size * fillRatio;
        drawH = (size * fillRatio) / imgAspect;
      } else {
        drawH = size * fillRatio;
        drawW = (size * fillRatio) * imgAspect;
      }
      const drawX = (size - drawW) / 2;
      const drawY = (size - drawH) / 2;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      drawText(ctx, size, text);
    };

    // Use cached image if available — instant render
    if (imageCache.current[url]) {
      renderImage(imageCache.current[url]);
    } else {
      // First load — cache and render
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache.current[url] = img;
        renderImage(img);
      };
      img.src = url;
    }
  }, [drawText]);

  // Trigger canvas redraw when image or debounced text changes
  useEffect(() => {
    drawCanvas(mainImage, debouncedEngravingText);
  }, [mainImage, debouncedEngravingText, drawCanvas]);

  // Also redraw immediately during drag (position changes)
  useEffect(() => {
    if (isDragging) {
      drawCanvas(mainImage, engravingText);
    }
  }, [engravingPosX, engravingPosY, isDragging]);

  // Selection handler — receives the FULL variant object
  function handleSelectVariation(variant: ProductVariant) {
    setSelected(variant);
    setSelectedImageIndex(0);
  }

  // Canvas drag handlers for engraving position
  const getCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 50, y: 72 };
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
  };

  const isOnText = (clientX: number, clientY: number): boolean => {
    if (!engravingText.trim()) return false;
    const coords = getCanvasCoords(clientX, clientY);
    return Math.abs(coords.x - engravingPosX) < 15 && Math.abs(coords.y - engravingPosY) < 5;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!engravingText.trim() || !isOnText(e.clientX, e.clientY)) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = { startX: e.clientX, startY: e.clientY, posX: engravingPosX, posY: engravingPosY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current || !canvasRef.current) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStartRef.current.startX) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStartRef.current.startY) / rect.height) * 100;
    setEngravingPosX(Math.max(5, Math.min(95, dragStartRef.current.posX + deltaX)));
    setEngravingPosY(Math.max(5, Math.min(95, dragStartRef.current.posY + deltaY)));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setHasDragged(true);
    dragStartRef.current = null;
    // Final redraw at resting position
    drawCanvas(mainImage, engravingText);
  };

  const handleCanvasClick = () => {
    if (isDragging || hasDragged) {
      setTimeout(() => setHasDragged(false), 100);
      return;
    }
    setIsZoomed(true);
  };

  // Perform the actual add-to-cart mutation
  const doAddToCart = () => {
    if (!product) return;
    const text = engravingText.trim() || undefined;
    let previewImage: string | undefined;
    if (text && canvasRef.current) {
      previewImage = canvasRef.current.toDataURL('image/png') || undefined;
    }

    addToCart.mutate({
      productId: product.id,
      quantity,
      customizationNotes: engravingText || undefined,
      engravingText: text,
      engravingPositionX: text ? Math.round(engravingPosX * 100) / 100 : undefined,
      engravingPositionY: text ? Math.round(engravingPosY * 100) / 100 : undefined,
      engravingPreviewImage: previewImage,
      productColor: selected?.color_name || undefined,
    }, {
      onSuccess: () => {
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2000);
      },
    });
  };

  // Adiciona ao carrinho sem exigir login — visitante usa localStorage
  const handleAddToCart = () => {
    doAddToCart();
  };

  const handleCepLookup = async () => {
    const cep = cepInput.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setFetchingCep(true);
    setShippingResult(null);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) {
        setShippingResult('CEP não encontrado. Verifique e tente novamente.');
      } else {
        // Simulação de cálculo — em produção integrar com correios/melhor envio
        setShippingResult(`Entrega para ${data.localidade}/${data.uf} — Frete grátis para pedidos acima de R$ 150,00. Consulte prazo no checkout.`);
      }
    } catch {
      setShippingResult('Não foi possível calcular o frete. Tente novamente.');
    } finally {
      setFetchingCep(false);
    }
  };

  const handleAuthSuccess = () => {};


  // Loading state with skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-8">
          <Skeleton className="h-4 w-64 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-4">
              <Skeleton className="aspect-square rounded-xl" />
              <div className="flex gap-2">
                <Skeleton className="w-[70px] h-[70px] rounded-lg" />
                <Skeleton className="w-[70px] h-[70px] rounded-lg" />
                <Skeleton className="w-[70px] h-[70px] rounded-lg" />
              </div>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-9 w-3/4" />
              <Skeleton className="h-10 w-40" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-24 rounded-lg" />
                <Skeleton className="h-10 w-24 rounded-lg" />
                <Skeleton className="h-10 w-24 rounded-lg" />
              </div>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Not found
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

  const hasDiscount = product.compare_price && product.compare_price > product.price;
  const discountPercentage = hasDiscount
    ? Math.round((1 - product.price / product.compare_price!) * 100)
    : 0;
  const isOutOfStock = (product.stock ?? 0) <= 0;
  const hasVariants = variants.length > 0;
  const showDragHint = engravingText.trim().length > 0 && !hasDragged;

  return (
    <div className="min-h-screen flex flex-col">
      <SEOMeta
        title={product.name}
        description={product.description?.slice(0, 160) || `${product.name} — Personalizado com gravação a laser. ${formatCurrency(product.price)} no Custom For Life Studio.`}
        image={product.images?.[0]}
        type="product"
      />
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

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Image Gallery */}
          <div className="space-y-4 lg:col-span-3">
            <div
              className="relative aspect-square rounded-xl overflow-hidden"
              style={{ backgroundColor: '#FFFFFF' }}
            >
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`w-full h-full ${isDragging ? 'cursor-grabbing' : engravingText.trim() ? 'cursor-grab' : 'cursor-zoom-in'}`}
                style={{ backgroundColor: '#FFFFFF', touchAction: 'none' }}
                aria-label={product.name}
              />
              {showDragHint && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none animate-pulse">
                  <Hand className="h-3.5 w-3.5" />
                  Arraste o texto na foto para escolher onde gravar
                </div>
              )}
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
                className="fixed inset-0 z-50 bg-white flex items-center justify-center cursor-zoom-out"
                onClick={() => setIsZoomed(false)}
              >
                <button
                  className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 z-50"
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
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      idx === selectedImageIndex
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-transparent hover:border-muted-foreground/30'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-contain" loading="lazy" width={80} height={80} />
                  </button>
                ))}
              </div>
            )}

            {/* Color variant thumbnails */}
            {hasVariants && variants.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 pl-3 mt-6 pt-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleSelectVariation(v)}
                    className="flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer group"
                  >
                    <div
                      className={`w-[70px] h-[70px] rounded-lg overflow-hidden transition-all ${
                        selected?.id === v.id
                          ? 'border-2 scale-[1.08]'
                          : 'border-[1.5px] border-white/15 group-hover:opacity-85'
                      }`}
                      style={selected?.id === v.id ? { borderColor: '#EF9F27' } : undefined}
                    >
                      <img
                        src={v.main_image || '/placeholder.svg'}
                        alt={v.color_name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                        width={70}
                        height={70}
                      />
                    </div>
                    <span
                      className={`text-[11px] text-center leading-tight ${
                        selected?.id === v.id ? 'font-medium' : 'text-white/70'
                      }`}
                      style={selected?.id === v.id ? { color: '#EF9F27' } : undefined}
                    >
                      {v.color_name}
                    </span>
                  </button>
                ))}
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
            <div className="space-y-1">
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
              {getInstallmentText(product.price) && (
                <p className="text-sm text-muted-foreground">
                  ou <span className="font-semibold text-foreground">{getInstallmentText(product.price)}</span> no cartão
                </p>
              )}
            </div>

            {/* Color Selector */}
            {hasVariants && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Cor: <span className="text-primary">{selected?.color_name}</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => handleSelectVariation(v)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                        selected?.id === v.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 text-foreground'
                      }`}
                    >
                      {v.color_name}
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
                Personalização — gravação a laser incluída no preço
              </Label>
              <Textarea
                id="customization"
                value={engravingText}
                onChange={(e) => setEngravingText(e.target.value)}
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
                className={`flex-1 transition-all ${addedToCart ? 'bg-[#1D9E75] hover:bg-[#1D9E75]' : ''}`}
                onClick={handleAddToCart}
                disabled={isOutOfStock || addToCart.isPending || addedToCart}
              >
                {addedToCart ? (
                  <>✓ Adicionado!</>
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    {isOutOfStock ? 'Esgotado' : 'Adicionar ao Carrinho'}
                  </>
                )}
              </Button>
            </div>

            {/* Stock info */}
            {!isOutOfStock && product.stock && product.stock <= 10 && (
              <p className="text-sm text-secondary font-medium">
                ⚡ Apenas {product.stock} unidades em estoque!
              </p>
            )}

            {/* Calculador de Frete */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                Calcular Frete
              </p>
              <div className="flex gap-2">
                <Input
                  value={cepInput}
                  onChange={e => setCepInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="00000-000"
                  maxLength={9}
                  className="flex-1"
                  onKeyDown={e => e.key === 'Enter' && handleCepLookup()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCepLookup}
                  disabled={fetchingCep || cepInput.length < 8}
                >
                  {fetchingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calcular'}
                </Button>
              </div>
              {shippingResult && (
                <p className="text-sm text-muted-foreground">{shippingResult}</p>
              )}
            </div>
          </div>
        </div>

        {/* Ficha Técnica */}
        {product.category?.technical_sheet && Array.isArray(product.category.technical_sheet) && product.category.technical_sheet.length > 0 && (
          <div className="mt-12 border-t pt-8">
            <h2 className="text-2xl font-bold mb-6">📋 Ficha Técnica</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(product.category.technical_sheet as { title: string; items: { label: string; value: string }[] }[]).map((section, sIdx) => (
                <div key={sIdx} className="border rounded-lg p-4 bg-card">
                  <h3 className="font-semibold text-primary mb-3">{section.title}</h3>
                  <div className="space-y-2">
                    {section.items.map((item, iIdx) => (
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

        {/* Produtos Relacionados */}
        {relatedProducts.length > 0 && (
          <div className="mt-12 border-t pt-8">
            <h2 className="text-2xl font-bold mb-6">Você também pode gostar</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((rp) => (
                <ProductCard key={rp.id} product={rp} />
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />

      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        defaultTab="login"
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
