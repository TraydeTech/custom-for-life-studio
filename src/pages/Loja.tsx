import React, { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { SEOMeta } from '@/components/SEOMeta';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard } from '@/components/shop/ProductCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, X, SlidersHorizontal } from 'lucide-react';

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

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', categorySlug, searchQuery],
    staleTime: 1000 * 60 * 5, // 5 minutos
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name, slug, price, compare_price, images, is_featured, stock, category_id, category:categories(name, slug)')
        .eq('is_active', true)
        .gt('stock', 0);

      if (categorySlug && categories.length > 0) {
        const category = categories.find(c => c.slug === categorySlug);
        if (category) query = query.eq('category_id', category.id);
      }

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: categories.length > 0 || !categorySlug,
  });

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

  const sortedProducts = useMemo(() => {
    const list = [...products];
    if (sortBy === 'price_asc') return list.sort((a, b) => a.price - b.price);
    if (sortBy === 'price_desc') return list.sort((a, b) => b.price - a.price);
    if (sortBy === 'featured') return list.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
    return list; // newest — já ordenado por created_at desc
  }, [products, sortBy]);

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
                  {sortedProducts.length > 0
                    ? `${sortedProducts.length} produto${sortedProducts.length !== 1 ? 's' : ''} encontrado${sortedProducts.length !== 1 ? 's' : ''}`
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
                    <Skeleton className="aspect-square rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : sortedProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
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
