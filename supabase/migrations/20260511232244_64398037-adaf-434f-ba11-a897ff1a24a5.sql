-- Garante slug único de produto
DROP INDEX IF EXISTS public.idx_products_slug;
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON public.products (slug);