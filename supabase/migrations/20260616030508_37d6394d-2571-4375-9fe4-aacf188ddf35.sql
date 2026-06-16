-- إعادة منح SELECT على كل الأعمدة عدا password_hash (للحفاظ على حماية الهاش)
GRANT SELECT (id, name, description, owner_id, created_at, type, max_members, is_active, background_url, background_type) ON public.rooms TO authenticated;
GRANT SELECT (id, name, description, owner_id, created_at, type, max_members, is_active, background_url, background_type) ON public.rooms TO anon;