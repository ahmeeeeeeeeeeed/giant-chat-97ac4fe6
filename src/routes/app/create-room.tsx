import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Lock, Globe, ArrowRight, Loader2, Eye, EyeOff, Shield, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/app/create-room")({
  component: CreateRoomPage,
});

function CreateRoomPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("");
  const [description, setDescription] = useState("");
  const [roomType, setRoomType] = useState<"public" | "private">("public");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [maxMembers, setMaxMembers] = useState(50);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roomName.trim()) {
      toast.error("يرجى إدخال اسم الغرفة");
      return;
    }

    if (roomType === "private" && !password.trim()) {
      toast.error("يرجى إدخال كلمة مرور للغرفة الخاصة");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("rooms")
      .insert({
        name: roomName.trim(),
        description: description.trim() || null,
        type: roomType,
        password: roomType === "private" ? password : null,
        max_members: maxMembers,
        owner_id: user!.id,
        is_active: true,
      } as never)
      .select()
      .single();

    setLoading(false);

    if (error) {
      toast.error("فشل إنشاء الغرفة: " + error.message);
    } else {
      toast.success("تم إنشاء الغرفة بنجاح!");
      navigate({ to: "/app/room/$id", params: { id: data.id } });
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <button
          onClick={() => navigate({ to: "/app" })}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowRight className="h-5 w-5 rtl:rotate-180" />
          <span>الرجوع</span>
        </button>
        <h1 className="text-2xl font-extrabold">إنشاء غرفة جديدة</h1>
        <p className="text-sm text-muted-foreground">أنشئ غرفة دردشة خاصة أو عامة</p>
      </header>

      <div className="p-6 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">اسم الغرفة *</label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="مثال: غرفة الأصدقاء"
              className="w-full h-12 rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary"
              maxLength={50}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">الوصف (اختياري)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف الغرفة..."
              rows={3}
              className="w-full rounded-xl border border-input bg-background p-4 text-sm outline-none focus:border-primary"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">نوع الغرفة</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRoomType("public")}
                className={`flex items-center justify-center gap-2 h-12 rounded-xl border font-semibold transition ${
                  roomType === "public"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50"
                }`}
              >
                <Globe className="h-4 w-4" />
                عامة
              </button>
              <button
                type="button"
                onClick={() => setRoomType("private")}
                className={`flex items-center justify-center gap-2 h-12 rounded-xl border font-semibold transition ${
                  roomType === "private"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50"
                }`}
              >
                <Lock className="h-4 w-4" />
                خاصة بكلمة مرور
              </button>
            </div>
          </div>

          {roomType === "private" && (
            <div>
              <label className="block text-sm font-medium mb-2">كلمة المرور *</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور الغرفة"
                  className="w-full h-12 rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                المشاركون سيحتاجون إلى كلمة المرور للانضمام
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              الحد الأقصى للأعضاء: {maxMembers}
            </label>
            <input
              type="range"
              min={5}
              max={200}
              value={maxMembers}
              onChange={(e) => setMaxMembers(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-98 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            ) : (
              <span className="flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4" />
                إنشاء الغرفة
              </span>
            )}
          </button>
        </form>

        <div className="mt-8 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>كمشرف على الغرفة، ستتمكن من:</span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>• حظر وإلغاء حظر الأعضاء</li>
            <li>• تعيين مشرفين إضافيين</li>
            <li>• حذف رسائل المخالفين</li>
            <li>• دعوة أعضاء جدد</li>
          </ul>
        </div>
      </div>
    </main>
  );
}