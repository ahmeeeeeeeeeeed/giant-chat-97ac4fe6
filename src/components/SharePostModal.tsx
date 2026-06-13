import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { X, ImagePlus, Loader2, Send, Megaphone } from "lucide-react";
import { toast } from "sonner";

const db = supabase as any;

export function SharePostModal({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async () => {
    if (!user) return;
    if (!text.trim() && !file) { toast.error("اكتب نصاً أو أرفق صورة"); return; }
    setBusy(true);
    try {
      let image_url: string | null = null;
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error("الحد الأقصى 5 ميجابايت");
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/share/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("room-media").upload(path, file, {
          contentType: file.type || "image/jpeg", upsert: false,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("room-media").getPublicUrl(path);
        image_url = pub.publicUrl;
      }
      const { error } = await db.rpc("share_post_to_all_rooms", {
        _text: text.trim() || null,
        _image_url: image_url,
        _source_room: roomId,
      });
      if (error) throw error;
      toast.success("تم نشر المنشور في كل الغرف");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "فشل النشر");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h3 className="font-bold">نشر منشور في كل الغرف</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={1000}
          placeholder="ما الذي تريد مشاركته مع الجميع؟"
          className="w-full resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary"
        />
        {preview && file && (
          <div className="relative mt-2 overflow-hidden rounded-xl border border-border">
            <img src={preview} className="max-h-64 w-full object-cover" alt="" />
            <button onClick={() => pick(null)}
              className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          <button onClick={() => fileRef.current?.click()}
            className="flex h-10 items-center gap-1 rounded-xl bg-emerald-500/10 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <ImagePlus className="h-4 w-4" /> صورة
          </button>
          <button onClick={submit} disabled={busy}
            className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            نشر للجميع
          </button>
        </div>
      </div>
    </div>
  );
}

export function SharedPostCard({ meta }: { meta: any }) {
  return (
    <div className="mx-auto my-2 w-full max-w-md rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-secondary p-3 shadow">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-primary">
        📝 منشور مشترك{meta.source_room_name ? ` · من «${meta.source_room_name}»` : ""}
      </div>
      <div className="text-xs font-bold mb-1">{meta.author_name || "مستخدم"}</div>
      {meta.text && <p className="whitespace-pre-wrap text-sm leading-relaxed">{meta.text}</p>}
      {meta.image_url && (
        <a href={meta.image_url} target="_blank" rel="noreferrer">
          <img src={meta.image_url} className="mt-2 max-h-72 w-full rounded-xl object-cover" alt="" loading="lazy" />
        </a>
      )}
    </div>
  );
}
