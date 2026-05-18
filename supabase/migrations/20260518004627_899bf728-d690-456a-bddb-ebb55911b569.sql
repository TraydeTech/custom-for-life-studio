-- Add stock column to product_variants
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

-- Comment out the global stock column if we want to move away from it, 
-- but for now let's just keep it and we'll stop using it in the UI.
-- ALTER TABLE public.products DROP COLUMN stock; 

-- Optional: Migrate existing product stock to the first variant if applicable
-- This is tricky if there are multiple variants, but for now we'll just start fresh or let users re-enter.
