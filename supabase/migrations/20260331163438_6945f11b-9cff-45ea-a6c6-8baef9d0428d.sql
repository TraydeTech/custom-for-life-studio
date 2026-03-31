
-- Allow authenticated users to upload files to product-images bucket
CREATE POLICY "Allow authenticated upload to product-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Allow authenticated users to update files in product-images bucket
CREATE POLICY "Allow authenticated update product-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

-- Allow authenticated users to delete files in product-images bucket
CREATE POLICY "Allow authenticated delete product-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- Allow public read access to product-images bucket
CREATE POLICY "Allow public read product-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');
