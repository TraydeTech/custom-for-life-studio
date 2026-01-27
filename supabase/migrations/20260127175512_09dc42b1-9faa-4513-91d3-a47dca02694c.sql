-- Add cost_price column to products table for tracking purchase price from suppliers
ALTER TABLE public.products 
ADD COLUMN cost_price numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.products.cost_price IS 'Preço de custo/compra do fornecedor';