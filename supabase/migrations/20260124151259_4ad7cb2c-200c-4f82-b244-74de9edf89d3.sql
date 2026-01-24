-- Add column to track order source (PDV or Website)
ALTER TABLE public.orders 
ADD COLUMN source text DEFAULT 'site';

-- Add comment for clarity
COMMENT ON COLUMN public.orders.source IS 'Order source: pdv for physical store, site for website';