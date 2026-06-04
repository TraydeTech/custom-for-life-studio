import React, { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { SEOMeta } from '@/components/SEOMeta';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard } from '@/components/shop/ProductCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, X, SlidersHorizontal, Loader2, MessageCircle } from 'lucide-react';

const PAGE_SIZE = 12;

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'featured';

export default function Loja() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categorySlug = searchParams.get('categoria');
  const searchQuery = searchParams.get('busca') || '';
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    staleTime: 1000 * 60 * 10, // 10 minutos
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, sort_order')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const activeCategoryId = useMemo(() => {
    if (!categorySlug) return null;
    return categories.find(c => c.slug === categorySlug)?.id ?? null;
  }, [categories, categorySlug]);

  const {
    data: productsData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['products', categorySlug, searchQuery, activeCategoryId, sortBy],
    staleTime: 1000 * 60 * 5,
    initialPageParam: 0,
    enabled: categories.length > 0 || !categorySlug,
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('products')
        .select('id, name, slug, price, compare_price, images, is_featured, stock, category_id, category:categories(name, slug)')
        .eq('is_active', true);

      if (activeCategoryId) {
        query = query.eq('category_id', activeCategoryId);
      }

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      // Ordenação no servidor
      if (sortBy === 'price_asc') query = query.order('price', { ascending: true });
      else if (sortBy === 'price_desc') query = query.order('price', { ascending: false });
      else if (sortBy === 'featured') query = query.order('is_featured', { ascending: false }).order('created_at', { ascending: false });
      else query = query.order('created_at', { ascending: false });

      const { data, error } = await query.range(from, to);
      if (error) throw error;
      return { items: data ?? [], nextPage: (data?.length ?? 0) === PAGE_SIZE ? pageParam + 1 : null };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const products = useMemo(
    () => productsData?.pages.flatMap(p => p.items) ?? [],
    [productsData]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localSearch.trim()) {
      setSearchParams({ busca: localSearch.trim() });
    } else {
      searchParams.delete('busca');
      setSearchParams(searchParams);
    }
  };

  const clearFilters = () => {
    setSearchParams({});
    setLocalSearch('');
  };

  const activeCategory = categories.find(c => c.slug === categorySlug);

  return (
    <div className="min-h-screen flex flex-col">
      <SEOMeta
        title={activeCategory ? `${activeCategory.name} — Brindes Personalizados` : 'Loja — Todos os Produtos'}
        description="Explore nossa linha completa de brindes personalizados. Filtros por categoria, preço e destaques. Entrega para todo o Brasil."
      />
      <Header />
      
      <main className="flex-1 container py-8">
        {/* Breadcrumb e título */}
        <div className="mb-8">
          <nav className="text-sm text-muted-foreground mb-2">
            <Link to="/" className="hover:text-primary">Início</Link>
            <span className="mx-2">/</span>
            <span>Loja</span>
            {activeCategory && (
              <>
                <span className="mx-2">/</span>
                <span>{activeCategory.name}</span>
              </>
            )}
          </nav>
          <h1 className="text-3xl font-bold">
            {activeCategory ? activeCategory.name : 'Todos os Produtos'}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Escolha o produto ideal para personalizar com sua marca. Trabalhamos com itens úteis, bonitos e pensados para empresas, eventos, equipes e presentes especiais. Se precisar de ajuda, fale conosco pelo WhatsApp.
          </p>
          <div className="mt-4">
            <Button asChild>
              <a 
                href={`https://wa.me/5547984492949?text=${encodeURIComponent('Olá! Vim pelo site e gostaria de solicitar uma ajuda para escolher brindes personalizados.')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Solicitar ajuda pelo WhatsApp
              </a>
            </Button>
          </div>
          {searchQuery && (
            <p className="text-muted-foreground mt-2">
              Resultados para "{searchQuery}"
            </p>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar de filtros */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="sticky top-24 space-y-6">
              {/* Busca */}
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Buscar produtos..."
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </form>

              {/* Categorias */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Categorias
                </h3>
                <div className="space-y-1">
                  <Button
                    variant={!categorySlug ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      searchParams.delete('categoria');
                      setSearchParams(searchParams);
                    }}
                  >
                    Todos os Produtos
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant={categorySlug === category.slug ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setSearchParams({ categoria: category.slug })}
                    >
                      {category.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Limpar filtros */}
              {(categorySlug || searchQuery) && (
                <Button variant="outline" size="sm" className="w-full" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Limpar Filtros
                </Button>
              )}
            </div>
          </aside>

          {/* Grid de produtos */}
          <div className="flex-1">
            {/* Barra de ordenação e contagem */}
            {!isLoading && (
              <div className="flex items-center justify-between mb-4 gap-4">
                <p className="text-sm text-muted-foreground">
                  {products.length > 0
                    ? `${products.length} produto${products.length !== 1 ? 's' : ''} carregado${products.length !== 1 ? 's' : ''}${hasNextPage ? '+' : ''}`
                    : ''}
                </p>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger className="w-44 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Mais recentes</SelectItem>
                      <SelectItem value="featured">Destaques primeiro</SelectItem>
                      <SelectItem value="price_asc">Menor preço</SelectItem>
                      <SelectItem value="price_desc">Maior preço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="space-y-4">
                    <Skeleton className="aspect-square rounded-lg bg-[#FFFFFF]" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : products.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                {hasNextPage && (
                  <div className="flex justify-center mt-8">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Carregar mais produtos
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">
                  Nenhum produto encontrado.
                </p>
                <Button variant="link" onClick={clearFilters}>
                  Ver todos os produtos
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
