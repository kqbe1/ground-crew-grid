
-- Create storage bucket for intervention photos
INSERT INTO storage.buckets (id, name, public) VALUES ('intervention-photos', 'intervention-photos', true);

-- Create storage bucket for intervention signatures  
INSERT INTO storage.buckets (id, name, public) VALUES ('intervention-signatures', 'intervention-signatures', true);

-- RLS: Authenticated users can upload photos
CREATE POLICY "Authenticated can upload photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'intervention-photos');

-- RLS: Anyone can view photos (public bucket)
CREATE POLICY "Public can view photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'intervention-photos');

-- RLS: Owner or admin can delete photos
CREATE POLICY "Owner or admin can delete photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'intervention-photos' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));

-- RLS: Authenticated can upload signatures
CREATE POLICY "Authenticated can upload signatures"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'intervention-signatures');

-- RLS: Anyone can view signatures
CREATE POLICY "Public can view signatures"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'intervention-signatures');

-- RLS: Owner or admin can delete signatures
CREATE POLICY "Owner or admin can delete signatures"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'intervention-signatures' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));
