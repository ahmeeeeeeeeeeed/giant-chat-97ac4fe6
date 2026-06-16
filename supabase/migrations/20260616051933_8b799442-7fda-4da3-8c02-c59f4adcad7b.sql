
CREATE POLICY "stories_obj_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'stories');
CREATE POLICY "stories_obj_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "stories_obj_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);
