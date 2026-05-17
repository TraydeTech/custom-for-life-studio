import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
import { formatCurrency, cn } from '@/lib/utils';
import { ShoppingCart, Minus, Plus, ChevronRight, X, Hand, Truck, Loader2, CheckCircle, RotateCcw, Type, Upload, Paperclip, ShieldCheck, Zap, Heart } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { AuthModal } from '@/components/auth/AuthModal';
import { ProductCard } from '@/components/shop/ProductCard';
import { SEOMeta } from '@/components/SEOMeta';
import { getInstallmentText } from '@/lib/installments';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [engravingRotation, setEngravingRotation] = useState(0);
  const [engravingScale, setEngravingScale] = useState(1);
  const [engravingColor, setEngravingColor] = useState<'white' | 'black'>('white');
  const [engravingFile, setEngravingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
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

  const variants: ProductVariant[] = useMemo(() => {
    const list = (productData as any)?.product_variants;
    if (!list) return [];
    return [...list].sort(
      (a: ProductVariant, b: ProductVariant) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
  }, [productData]);

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
    const baseFontSize = size * 0.045;
    const fontSize = Math.max(12, baseFontSize * engravingScale);
    const textX = (engravingPosX / 100) * size;
    const textY = (engravingPosY / 100) * size;

    ctx.save();
    ctx.translate(textX, textY);
    ctx.rotate((engravingRotation * Math.PI) / 180);
    
    ctx.font = `600 ${fontSize}px "Inter", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Dynamic shadow based on text color
    ctx.shadowColor = engravingColor === 'white' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = engravingColor === 'white' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)';
    
    // Split text by new lines to support multi-line engraving
    const lines = text.split('\n');
    const lineHeight = fontSize * 1.2;
    const totalHeight = (lines.length - 1) * lineHeight;
    
    lines.forEach((line, index) => {
      const yOffset = (index * lineHeight) - (totalHeight / 2);
      ctx.fillText(line, 0, yOffset);
    });
    
    ctx.restore();
  }, [engravingPosX, engravingPosY, engravingRotation, engravingScale, engravingColor]);

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
  }, [mainImage, debouncedEngravingText, engravingRotation, engravingScale, engravingColor, drawCanvas]);

  // Also redraw immediately during drag (position changes)
  useEffect(() => {
    if (isDragging) {
      drawCanvas(mainImage, engravingText);
    }
  }, [engravingPosX, engravingPosY, isDragging, engravingRotation, engravingScale, engravingColor]);

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
    // Increase hit area based on scale
    const hitWidth = 15 * engravingScale;
    const hitHeight = 5 * engravingScale;
    // For simplicity, we keep a rectangular hit area even if rotated
    // but we expand it slightly if rotated to ensure user can still grab it
    const padding = engravingRotation % 180 !== 0 ? 10 : 0;
    return Math.abs(coords.x - engravingPosX) < (hitWidth + padding) && 
           Math.abs(coords.y - engravingPosY) < (hitHeight + padding);
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
  const doAddToCart = async () => {
    if (!product) return;
    
    let uploadedFileUrl = undefined;
    if (engravingFile) {
      setIsUploading(true);
      try {
        const fileExt = engravingFile.name.split('.').pop();
        const fileName = `${user?.id || 'guest'}-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${user?.id || 'anonymous'}/${fileName}`;

        const { data, error } = await supabase.storage
          .from('engravings')
          .upload(filePath, engravingFile);

        if (error) throw error;
        
        const { data: { publicUrl } } = supabase.storage
          .from('engravings')
          .getPublicUrl(data.path);
          
        uploadedFileUrl = publicUrl;
      } catch (error) {
        console.error('Error uploading file:', error);
        // We continue even if upload fails, but you might want to show an error toast
      } finally {
        setIsUploading(false);
      }
    }

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
      engravingFileUrl: uploadedFileUrl,
    }, {
      onSuccess: () => {
        setAddedToCart(true);
        setEngravingFile(null);
        setTimeout(() => setAddedToCart(false), 2000);
      },
    });
  };

  // Tentativa de adicionar ao carrinho — exige autenticação. Se não logado,
  // marca a intenção e abre o modal; após login bem-sucedido, retoma a ação.
  const [pendingAddToCart, setPendingAddToCart] = useState(false);

  const handleAddToCart = () => {
    if (!user) {
      setPendingAddToCart(true);
      setShowAuthModal(true);
      return;
    }
    doAddToCart();
  };

  // Após login via modal, retoma a adição ao carrinho preservando variante,
  // quantidade e personalização que estavam selecionadas antes do login.
  const handleAuthSuccess = () => {
    if (pendingAddToCart) {
      setPendingAddToCart(false);
      // Pequeno delay para garantir que o contexto de auth atualizou
      setTimeout(() => doAddToCart(), 50);
    }
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


  // Loading state with skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-8">
          <Skeleton className="h-4 w-64 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-4">
              <Skeleton className="aspect-square rounded-xl bg-[#FFFFFF]" />
              <div className="flex gap-2">
                 <Skeleton className="w-[70px] h-[70px] rounded-lg bg-[#FFFFFF]" />
                 <Skeleton className="w-[70px] h-[70px] rounded-lg bg-[#FFFFFF]" />
                 <Skeleton className="w-[70px] h-[70px] rounded-lg bg-[#FFFFFF]" />
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Image Gallery Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="sticky top-24">
              <div
                className="relative aspect-square rounded-2xl overflow-hidden shadow-sm border bg-white"
              >
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className={cn(
                    "w-full h-full transition-opacity duration-300",
                    isDragging ? 'cursor-grabbing' : engravingText.trim() ? 'cursor-grab' : 'cursor-zoom-in'
                  )}
                  style={{ touchAction: 'none' }}
                  aria-label={product.name}
                />
                {showDragHint && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/80 backdrop-blur-sm text-white text-xs font-medium px-4 py-2 rounded-full pointer-events-none animate-pulse shadow-lg">
                    <Hand className="h-3.5 w-3.5" />
                    Arraste o texto para posicionar
                  </div>
                )}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {product.is_featured && (
                    <Badge className="bg-primary text-primary-foreground font-semibold px-3 py-1 shadow-sm">
                      Destaque
                    </Badge>
                  )}
                  {hasDiscount && (
                    <Badge variant="destructive" className="font-bold px-3 py-1 shadow-sm">
                      -{discountPercentage}%
                    </Badge>
                  )}
                </div>
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                    <Badge variant="secondary" className="text-xl px-6 py-3 font-bold shadow-xl border-2">Esgotado</Badge>
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={cn(
                      "flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all duration-200 bg-white shadow-sm",
                      idx === selectedImageIndex
                        ? "border-primary ring-2 ring-primary/10 scale-105"
                        : "border-transparent hover:border-muted-foreground/30 opacity-70 hover:opacity-100"
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-contain p-1" loading="lazy" />
                  </button>
                ))}
              </div>

              {/* Variant selection for desktop (visual) */}
              {hasVariants && variants.length > 1 && (
                <div className="mt-8">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" /> Opções de Cores
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => handleSelectVariation(v)}
                        className={cn(
                          "group relative flex flex-col items-center gap-2 p-2 rounded-xl transition-all border-2",
                          selected?.id === v.id 
                            ? "border-primary bg-primary/5 shadow-sm" 
                            : "border-transparent hover:bg-muted/50"
                        )}
                      >
                        <div className={cn(
                          "w-16 h-16 rounded-lg overflow-hidden border transition-transform duration-200",
                          selected?.id === v.id ? "scale-105" : "group-hover:scale-105"
                        )}>
                          <img src={v.main_image || '/placeholder.svg'} alt={v.color_name} className="w-full h-full object-contain p-1 bg-white" />
                        </div>
                        <span className={cn(
                          "text-[11px] font-medium leading-tight max-w-[64px] text-center",
                          selected?.id === v.id ? "text-primary" : "text-muted-foreground"
                        )}>
                          {v.color_name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Product Details Column */}
          <div className="lg:col-span-5 flex flex-col space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                {product.category && (
                  <Badge variant="outline" className="text-primary border-primary/20 hover:bg-primary/5 transition-colors">
                    <Link to={`/loja?categoria=${product.category.slug}`}>{product.category.name}</Link>
                  </Badge>
                )}
                <div className="flex items-center gap-2">
                   <Button variant="ghost" size="icon" className="rounded-full hover:text-red-500 hover:bg-red-50">
                     <Heart className="h-5 w-5" />
                   </Button>
                </div>
              </div>
              
              <h1 className="text-4xl font-bold tracking-tight text-foreground leading-tight">{product.name}</h1>
              
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-primary">{formatCurrency(product.price)}</span>
                    {hasDiscount && (
                      <span className="text-xl text-muted-foreground line-through opacity-70">{formatCurrency(product.compare_price!)}</span>
                    )}
                  </div>
                  {getInstallmentText(product.price) && (
                    <p className="text-sm text-muted-foreground font-medium">
                      Ou até <span className="text-foreground font-bold">{getInstallmentText(product.price)}</span> no cartão
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Selection Options */}
            <div className="space-y-6">
              {/* Color Selector */}
              {hasVariants && (
                <div className="space-y-3">
                  <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Escolha a Cor</Label>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((v) => (
                      <Button
                        key={v.id}
                        variant={selected?.id === v.id ? 'default' : 'outline'}
                        onClick={() => handleSelectVariation(v)}
                        className={cn(
                          "h-10 px-4 font-semibold transition-all",
                          selected?.id === v.id ? "shadow-md scale-105" : "hover:border-primary/50"
                        )}
                      >
                        {v.color_name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Customization Section */}
              <Card className="border-2 border-primary/10 overflow-hidden shadow-sm">
                <div className="p-5 space-y-6">
                  <div className="flex items-center gap-3 text-primary">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Type className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-lg">Personalize sua Peça</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <Label htmlFor="customization" className="text-sm font-semibold">Texto para gravação</Label>
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter bg-muted px-2 py-0.5 rounded">Gravação a Laser Grátis</span>
                      </div>
                      <Textarea
                        id="customization"
                        value={engravingText}
                        onChange={(e) => setEngravingText(e.target.value)}
                        placeholder="Nome, frase ou palavra..."
                        className="min-h-[100px] border-2 focus-visible:ring-primary/20 resize-none rounded-xl"
                        disabled={isOutOfStock}
                      />
                    </div>

                    {engravingText.trim().length > 0 && (
                      <div className="p-4 bg-muted/30 rounded-xl space-y-5 border animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase">
                            <span className="flex items-center gap-2"><Type className="h-3.5 w-3.5" /> Tamanho</span>
                            <span>{Math.round(engravingScale * 100)}%</span>
                          </div>
                          <Slider value={[engravingScale]} min={0.5} max={3} step={0.1} onValueChange={([val]) => setEngravingScale(val)} />
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase">
                            <span className="flex items-center gap-2"><RotateCcw className="h-3.5 w-3.5" /> Orientação</span>
                            <span>{engravingRotation}°</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Slider value={[engravingRotation]} min={0} max={360} step={1} onValueChange={([val]) => setEngravingRotation(val)} className="flex-1" />
                            <div className="flex gap-1 shrink-0">
                               <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setEngravingRotation(0)} title="Horizontal">H</Button>
                               <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setEngravingRotation(90)} title="Vertical">V</Button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-xs font-bold text-muted-foreground uppercase">Cor da Gravação</Label>
                          <div className="flex gap-4">
                            {[
                              { id: 'white', color: '#FFFFFF', label: 'Branco' },
                              { id: 'black', color: '#000000', label: 'Preto' }
                            ].map((c) => (
                              <button
                                key={c.id}
                                onClick={() => setEngravingColor(c.id as any)}
                                className={cn(
                                  "relative flex flex-col items-center gap-1.5 transition-all",
                                  engravingColor === c.id ? "scale-110" : "opacity-60 hover:opacity-100"
                                )}
                              >
                                <div className={cn(
                                  "w-8 h-8 rounded-full border-2 shadow-sm flex items-center justify-center",
                                  engravingColor === c.id ? "border-primary ring-2 ring-primary/20" : "border-border"
                                )} style={{ backgroundColor: c.color }}>
                                  {engravingColor === c.id && <CheckCircle className={cn("h-4 w-4", c.id === 'white' ? 'text-black' : 'text-white')} />}
                                </div>
                                <span className="text-[10px] font-bold">{c.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                       <input type="file" id="engraving-file" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setEngravingFile(file); }} accept="image/*,.pdf,.svg,.eps,.ai" />
                       <Button
                         variant="outline"
                         className={cn(
                           "w-full h-12 rounded-xl border-dashed border-2 hover:bg-primary/5 hover:border-primary transition-all flex items-center gap-3",
                           engravingFile && "bg-green-50 border-green-500 hover:bg-green-50 hover:border-green-500"
                         )}
                         onClick={() => document.getElementById('engraving-file')?.click()}
                       >
                         {engravingFile ? <CheckCircle className="h-5 w-5 text-green-600" /> : <Paperclip className="h-5 w-5" />}
                         <span className="font-semibold">{engravingFile ? "Arquivo Adicionado" : "Anexar logotipo ou arte"}</span>
                       </Button>
                       {engravingFile && (
                         <div className="mt-2 flex items-center justify-between bg-green-50/50 p-2 rounded-lg border border-green-100">
                           <span className="text-xs font-bold text-green-700 truncate max-w-[250px]">{engravingFile.name}</span>
                           <Button variant="ghost" size="icon" className="h-6 w-6 text-green-700 hover:bg-green-100" onClick={() => setEngravingFile(null)}><X className="h-3 w-3" /></Button>
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Quantity and CTA */}
            <div className="space-y-4 sticky bottom-4 lg:relative lg:bottom-0 bg-white/80 lg:bg-transparent backdrop-blur-md lg:backdrop-blur-0 p-4 lg:p-0 rounded-2xl shadow-lg lg:shadow-none border lg:border-0">
               <div className="flex items-stretch gap-4">
                  <div className="flex items-center bg-muted rounded-xl p-1 border shadow-inner">
                    <Button variant="ghost" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-10 w-10 rounded-lg" disabled={isOutOfStock}><Minus className="h-4 w-4" /></Button>
                    <span className="w-10 text-center font-bold">{quantity}</span>
                    <Button variant="ghost" size="icon" onClick={() => setQuantity(Math.min(product.stock || 99, quantity + 1))} className="h-10 w-10 rounded-lg" disabled={isOutOfStock}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <Button
                    size="lg"
                    className={cn(
                      "flex-1 h-12 text-lg font-bold rounded-xl shadow-lg transition-all duration-300",
                      addedToCart ? "bg-green-600 hover:bg-green-600 scale-105" : "bg-primary hover:shadow-primary/30"
                    )}
                    onClick={handleAddToCart}
                    disabled={isOutOfStock || addToCart.isPending || addedToCart}
                  >
                    {addedToCart ? <><CheckCircle className="mr-2 h-5 w-5" /> Adicionado!</> : <><ShoppingCart className="mr-2 h-5 w-5" /> Comprar Agora</>}
                  </Button>
               </div>
               
               {/* Shipping Preview */}
               <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground px-2">
                 <div className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Entrega em todo Brasil</div>
                 <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Compra 100% Segura</div>
               </div>
            </div>

            {/* Shipping Calculator */}
            <div className="bg-muted/30 p-4 rounded-xl space-y-3 border">
              <div className="flex items-center gap-2 text-sm font-bold"><Truck className="h-4 w-4 text-primary" /> Calcular prazo e frete</div>
              <div className="flex gap-2">
                <Input value={cepInput} onChange={e => setCepInput(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="00000-000" className="bg-white rounded-lg h-10" />
                <Button variant="secondary" onClick={handleCepLookup} disabled={fetchingCep || cepInput.length < 8} className="h-10 font-bold">{fetchingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calcular'}</Button>
              </div>
              {shippingResult && <p className="text-xs font-medium text-primary mt-1">{shippingResult}</p>}
            </div>
          </div>
        </div>

        {/* Product Info Tabs */}
        <div className="mt-20 border-t pt-12">
           <Tabs defaultValue="description" className="w-full">
              <TabsList className="w-full justify-start h-14 bg-transparent border-b rounded-none p-0 mb-8 gap-8">
                <TabsTrigger value="description" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-full font-bold px-0 text-lg">Descrição</TabsTrigger>
                {product.category?.technical_sheet && <TabsTrigger value="specs" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-full font-bold px-0 text-lg">Ficha Técnica</TabsTrigger>}
              </TabsList>
              <TabsContent value="description" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
                  <div className="md:col-span-7 space-y-8">
                     {product.description && <div className="prose prose-lg max-w-none text-muted-foreground leading-relaxed whitespace-pre-line">{product.description}</div>}
                     
                     {/* Dynamic Marketing Content based on name */}
                     {(product.name.toLowerCase().includes('copo') || product.name.toLowerCase().includes('garrafa')) && (
                       <div className="bg-primary/5 p-8 rounded-3xl border border-primary/10 space-y-6">
                         <h3 className="text-2xl font-bold text-foreground">Por que escolher nosso {(product.name.toLowerCase().includes('copo') ? 'Copo' : 'Garrafa')}?</h3>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {[
                              { title: "Durabilidade Premium", desc: "Aço inoxidável de alta resistência." },
                              { title: "Térmica Eficiente", desc: "Mantém a temperatura por horas." },
                              { title: "Laser de Precisão", desc: "Gravação permanente que não desbota." },
                              { title: "Eco-Friendly", desc: "Reduza o uso de descartáveis com estilo." }
                            ].map((item, i) => (
                              <div key={i} className="space-y-1">
                                <div className="flex items-center gap-2 font-bold text-primary"><CheckCircle className="h-4 w-4" /> {item.title}</div>
                                <p className="text-sm text-muted-foreground">{item.desc}</p>
                              </div>
                            ))}
                         </div>
                       </div>
                     )}
                  </div>
                  
                  <div className="md:col-span-5 space-y-6">
                    <Card className="p-6 bg-muted/20 border-none shadow-none rounded-3xl">
                       <h4 className="font-bold text-lg mb-4">Dúvidas Frequentes</h4>
                       <div className="space-y-4">
                          {[
                            { q: "A gravação sai com o tempo?", a: "Não, nossa gravação a laser é definitiva no metal." },
                            { q: "Posso gravar logotipos?", a: "Sim, selecione a opção de anexo e nos envie sua arte." },
                            { q: "Qual o prazo de produção?", a: "Geralmente entre 2 a 5 dias úteis após aprovação." }
                          ].map((faq, i) => (
                            <div key={i} className="space-y-1">
                               <p className="font-bold text-sm">{faq.q}</p>
                               <p className="text-sm text-muted-foreground">{faq.a}</p>
                            </div>
                          ))}
                       </div>
                    </Card>
                  </div>
                </div>
              </TabsContent>
              
              {product.category?.technical_sheet && (
                <TabsContent value="specs" className="mt-0">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {(product.category.technical_sheet as any[]).map((section, sIdx) => (
                        <div key={sIdx} className="p-6 rounded-3xl border bg-card/50">
                          <h3 className="font-bold text-primary mb-4 flex items-center gap-2">
                             <span className="w-1.5 h-6 bg-primary rounded-full" />
                             {section.title}
                          </h3>
                          <div className="space-y-3">
                            {section.items.map((item: any, iIdx: number) => (
                              <div key={iIdx} className="flex flex-col gap-0.5 border-b border-border/50 pb-2 last:border-0">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{item.label}</span>
                                <span className="text-sm font-medium">
                                  {item.label.includes('mínima') ? 'Consulte opções para pedidos unitários e empresas' : 
                                   item.label.includes('entrega') ? 'Varia conforme quantidade e personalização' :
                                   item.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                   </div>
                </TabsContent>
              )}
           </Tabs>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-24">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold">Inspirados por este item</h2>
              <Link to="/loja" className="text-primary font-bold hover:underline flex items-center gap-1">Ver tudo <ChevronRight className="h-4 w-4" /></Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
