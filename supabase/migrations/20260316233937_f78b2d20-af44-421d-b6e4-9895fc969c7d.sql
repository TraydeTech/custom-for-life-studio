-- Add engraving columns to order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS engraving_text text,
  ADD COLUMN IF NOT EXISTS engraving_position_x real,
  ADD COLUMN IF NOT EXISTS engraving_position_y real,
  ADD COLUMN IF NOT EXISTS engraving_preview_url text,
  ADD COLUMN IF NOT EXISTS product_color text;

-- Add engraving columns to cart_items for temporary storage
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS engraving_text text,
  ADD COLUMN IF NOT EXISTS engraving_position_x real,
  ADD COLUMN IF NOT EXISTS engraving_position_y real,
  ADD COLUMN IF NOT EXISTS engraving_preview_image text,
  ADD COLUMN IF NOT EXISTS product_color text;