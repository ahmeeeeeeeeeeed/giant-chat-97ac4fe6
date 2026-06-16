INSERT INTO public.shop_items (kind, code, name_ar, price, payload, sort_order) VALUES
  ('effect','entry_dragon','دخول التنين', 1000000, '{"entry_type":"dragon","emoji":"🐉"}'::jsonb, 100),
  ('effect','entry_princess','دخول الأميرة', 1000000, '{"entry_type":"princess","emoji":"👸"}'::jsonb, 101),
  ('effect','entry_knight','دخول الفارس', 1000000, '{"entry_type":"knight","emoji":"🐎"}'::jsonb, 102),
  ('effect','entry_magic','انفجار سحري', 1000000, '{"entry_type":"magic","emoji":"✨"}'::jsonb, 103),
  ('effect','entry_mascot','ترحيب احتفالي', 1000000, '{"entry_type":"mascot","emoji":"🤗"}'::jsonb, 104),
  ('effect','entry_portal','بوابة سحرية', 1000000, '{"entry_type":"portal","emoji":"🌀"}'::jsonb, 105)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  price = EXCLUDED.price,
  payload = EXCLUDED.payload,
  sort_order = EXCLUDED.sort_order;