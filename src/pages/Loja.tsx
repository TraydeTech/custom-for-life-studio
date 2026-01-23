import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard } from '@/components/shop/ProductCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Filter, X } from 'lucide-react';

export default function Loja() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categorySlug = searchParams.get('categoria');
  const searchQuery = searchParams.get('busca') || '';
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', categorySlug, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(name, slug)
        `)
        .eq('is_active', true);

      if (categorySlug) {
        const category = categories.find(c => c.slug === categorySlug);
        if (category) {
          query = query.eq('category_id', category.id);
        }
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

  return (
    <div className="min-h-screen flex flex-col">
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
            ) : products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
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
