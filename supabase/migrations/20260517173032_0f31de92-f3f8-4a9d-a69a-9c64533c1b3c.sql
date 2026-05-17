-- Add engraving_file_url to cart_items
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS engraving_file_url TEXT;

-- Add engraving_file_url to order_items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS engraving_file_url TEXT;

-- Create storage bucket for engravings if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('engravings', 'engravings', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for engravings bucket
CREATE POLICY "Engravings are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'engravings');

CREATE POLICY "Authenticated users can upload engravings"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'engravings' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own engravings"
ON storage.objects FOR DELETE
USING (bucket_id = 'engravings' AND (auth.uid())::text = (storage.foldername(name))[1]);
