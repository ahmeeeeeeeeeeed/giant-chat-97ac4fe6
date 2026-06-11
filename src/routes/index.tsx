import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    // إذا كان المستخدم مسجلاً → اذهب إلى الأصدقاء
    if (session) {
      throw redirect({ to: "/app/friends" });
    }
    
    // إذا لم يكن مسجلاً → اذهب إلى تسجيل الدخول
    throw redirect({ to: "/login" });
  },
});