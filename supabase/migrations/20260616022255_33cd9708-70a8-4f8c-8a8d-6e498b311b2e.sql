
-- room-backgrounds: each user uploads under their own user-id folder
CREATE POLICY "room-bg read auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'room-backgrounds');

CREATE POLICY "room-bg insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'room-backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "room-bg update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'room-backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "room-bg delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'room-backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);

-- profile-covers
CREATE POLICY "covers read auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'profile-covers');

CREATE POLICY "covers insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "covers update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "covers delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
