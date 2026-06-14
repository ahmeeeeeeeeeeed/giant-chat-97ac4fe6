import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flag, X, Image as ImageIcon, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { findAdminId } from "@/lib/find-admin";
import { toast } from "sonner";

export function ReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const pickFile = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    if (!f) { setFile(null); setPreview(null); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("الحد الأقصى 5 ميجابايت"); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const close = () => {
    if (sending) return;
    if (preview) URL.revokeObjectURL(preview);
    setText(""); setFile(null); setPreview(null);
    onClose();
  };

  const submit = async () => {
    if (!user) return;
    const body = text.trim();
    if (!body && !file) { toast.error("اكتب رسالتك أو أرفق صورة"); return; }
    setSending(true);
    try {
      const adminId = await findAdminId();
      if (!adminId) throw new Error("لم يتم العثور على حساب الإدارة");

      let mediaUrl: string | null = null;
      if (file) {
        const ext = file.type.split("/")[1] || "jpg";
        const path = `${user.id}/dm/${adminId}/report-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("room-media").upload(path, file, {
          contentType: file.type || "image/jpeg", upsert: false,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("room-media").getPublicUrl(path);
        mediaUrl = pub.publicUrl;
      }

      const prefix = "🚩 بلاغ/شكوى:\n";
      if (mediaUrl) {
        const { error } = await supabase.from("direct_messages").insert({
          sender_id: user.id, receiver_id: adminId, content: "",
          message_type: "image", media_url: mediaUrl,
        });
        if (error) throw error;
      }
      if (body) {
        const { error } = await supabase.from("direct_messages").insert({
          sender_id: user.id, receiver_id: adminId, content: prefix + body,
          message_type: "text",
        });
        if (error) throw error;
      } else if (!body && mediaUrl) {
        await supabase.from("direct_messages").insert({
          sender_id: user.id, receiver_id: adminId, content: prefix + "(صورة مرفقة)",
          message_type: "text",
        });
      }
      toast.success("تم إرسال البلاغ للإدارة");
      close();
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? "تعذر الإرسال";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={close}>
      <div onClick={(e) => e.stopPropagation()} dir="rtl"
        className="w-full max-w-md overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between gap-2 bg-gradient-to-br from-orange-500 to-red-500 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30">
              <Flag className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-extrabold leading-tight">الإبلاغ والشكاوى</div>
              <div className="text-[11px] text-white/80">تواصل مباشر مع الإدارة</div>
            </div>
          </div>
          <button onClick={close} aria-label="إغلاق" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="اكتب وصف المشكلة أو الاقتراح هنا…"
            rows={5}
            className="w-full resize-none rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
          />

          {preview ? (
            <div className="relative overflow-hidden rounded-2xl border border-border">
              <img src={preview} alt="معاينة" className="max-h-64 w-full object-cover" />
              <button onClick={() => pickFile(null)}
                className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => inputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/40 py-4 text-sm font-medium text-muted-foreground transition hover:bg-secondary">
              <ImageIcon className="h-4 w-4" />
              إرفاق صورة (اختياري)
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; pickFile(f); }} />

          <button onClick={submit} disabled={sending}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 py-3 font-bold text-white shadow-lg shadow-orange-500/30 transition active:scale-[0.98] disabled:opacity-60">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "جارٍ الإرسال…" : "إرسال للإدارة"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
