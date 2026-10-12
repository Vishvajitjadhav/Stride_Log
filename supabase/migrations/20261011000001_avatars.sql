-- Profile photos. Stored in a public "avatars" bucket under <user id>/...;
-- each person can only write inside their own folder.
ALTER TABLE profiles ADD COLUMN avatar_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 1048576, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars: public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars: own insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars: own update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars: own delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
