
CREATE OR REPLACE FUNCTION public.log_to_system_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE actor_name text; target_name text; msg text;
BEGIN
  SELECT username INTO actor_name FROM profiles WHERE id=NEW.actor_id;
  SELECT username INTO target_name FROM profiles WHERE id=NEW.target_id;
  msg := CASE NEW.event::text
    WHEN 'join'     THEN '🎉 أهلاً وسهلاً بـ ' || COALESCE(target_name,'مستخدم') || ' في الغرفة، نتمنى لك وقتاً ممتعاً معنا 🌟'
    WHEN 'leave'    THEN '👋 وداعاً ' || COALESCE(target_name,'مستخدم') || '، نتمنى لك يوماً سعيداً ونراك قريباً 💫'
    WHEN 'kick'     THEN '⚠️ تم طرد ' || COALESCE(target_name,'') || ' بواسطة ' || COALESCE(actor_name,'')
    WHEN 'ban'      THEN '🚫 تم حظر ' || COALESCE(target_name,'') || ' بواسطة ' || COALESCE(actor_name,'')
    WHEN 'promote'  THEN '⬆️ تمت ترقية ' || COALESCE(target_name,'') || ' إلى ' || COALESCE(NEW.meta->>'rank','إداري')
    WHEN 'demote'   THEN '⬇️ تم تخفيض ' || COALESCE(target_name,'') || ' إلى عضو'
    WHEN 'transfer' THEN '👑 تم نقل ملكية الغرفة إلى ' || COALESCE(target_name,'')
    ELSE NEW.event::text
  END;
  INSERT INTO public.room_messages(room_id, user_id, content, message_type, meta)
  VALUES (NEW.room_id, NULL, msg, 'system'::message_type,
          jsonb_build_object('kind','event','event',NEW.event::text,'actor',actor_name,'target',target_name));
  RETURN NEW;
END $function$;
