import { useEffect, useRef, useState } from "react";
import { X, Image as ImageIcon, Video, Type, Sparkles, Loader2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { publishStory, editStory, invalidateStoryCache, type StoryRow } from "@/lib/use-stories";
import { toast } from "sonner";

const BACKGROUNDS = [
  "linear-gradient(135deg,#0f172a,#1e293b)",
  "linear-gradient(135deg,#7c3aed,#ec4899)",
  "linear-gradient(135deg,#f59e0b,#ef4444)",
  "linear-gradient(135deg,#10b981,#0891b2)",
  "linear-gradient(135deg,#1e3a8a,#0ea5e9)",
  "linear-gradient(135deg,#000000,#374151)",
  "linear-gradient(135deg,#be185d,#7e22ce)",
  "linear-gradient(135deg,#065f46,#0f766e)",
];

const MAX_MB = 25;

export function CreateStoryDialog({
  open, onClose, onCreated, editing,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  editing?: StoryRow | null;
}) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const isEdit = !!editing;
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [existingMediaType, setExistingMediaType] = useState<"image" | "video" | null>(null);
  const [bg, setBg] = useState(BACKGROUNDS[0]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setContent(editing.content ?? "");
      setExistingMediaUrl(editing.media_url ?? null);
      setExistingMediaType(editing.media_type ?? null);
      setBg(editing.background ?? BACKGROUNDS[0]);
      setFile(null);
      setPreviewUrl(null);
    } else {
      setContent("");
      setFile(null);
      setPreviewUrl(null);
      setExistingMediaUrl(null);
      setExistingMediaType(null);
      setBg(BACKGROUNDS[0]);
    }
  }, [open, editing?.id]);

  if (!open) return null;

  const pickFile = (f: File | null) => {
    if (file && previewUrl) URL.revokeObjectURL(previewUrl);
    if (!f) { setFile(null); setPreviewUrl(null); return; }
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(`الحجم الأقصى ${MAX_MB} ميجابايت`); return; }
    if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) { toast.error("نوع غير مدعوم"); return; }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setExistingMediaUrl(null);
    setExistingMediaType(null);
  };

  const submit = async () => {
    if (!userId) return;
    const hasMedia = !!file || !!existingMediaUrl;
    if (!content.trim() && !hasMedia) { toast.error("اكتب نصاً أو أرفق وسائط"); return; }
    setBusy(true);
    try {
      let media_url: string | null = existingMediaUrl;
      let media_type: "image" | "video" | null = existingMediaType;
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("stories").upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("stories").createSignedUrl(path, 60 * 60 * 26);
        media_url = signed?.signedUrl ?? null;
        media_type = file.type.startsWith("video") ? "video" : "image";
      }
      if (isEdit && editing) {
        await editStory({
          id: editing.id,
          content: content.trim() || null,
          media_url,
          media_type,
          background: hasMedia ? null : bg,
        });
        toast.success("تم تحديث القصة ✨");
      } else {
        await publishStory({ content: content.trim() || null, media_url, media_type, background: hasMedia ? null : bg });
        toast.success("تم نشر القصة 🎉");
      }
      setContent(""); pickFile(null);
      onCreated?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message || (isEdit ? "فشل التحديث" : "فشل النشر"));
    } finally { setBusy(false); }
  };

  const isVideo = file?.type.startsWith("video") || existingMediaType === "video";
  const isImage = file?.type.startsWith("image") || existingMediaType === "image";
  const showImage = isImage && (previewUrl || existingMediaUrl);
  const showVideo = isVideo && (previewUrl || existingMediaUrl);
  const hasAnyMedia = !!file || !!existingMediaUrl;

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-md rounded-3xl bg-slate-950 border border-white/10 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-white font-bold">
            {isEdit ? <Pencil className="h-5 w-5 text-emerald-400" /> : <Sparkles className="h-5 w-5 text-amber-400" />}
            <span>{isEdit ? "تعديل القصة" : "إنشاء قصة جديدة"}</span>
          </div>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-full hover:bg-white/10 text-white" aria-label="إغلاق">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="relative aspect-[9/14] max-h-[60vh] w-full overflow-hidden flex items-center justify-center"
          style={hasAnyMedia ? { background: "#000" } : { background: bg }}
        >
          {showImage && <img src={(previewUrl || existingMediaUrl)!} alt="" className="max-w-full max-h-full object-contain" />}
          {showVideo && <video src={(previewUrl || existingMediaUrl)!} className="max-w-full max-h-full object-contain" controls />}
          {content && (
            <div className={`${hasAnyMedia ? "absolute inset-x-0 bottom-6 px-5" : "px-5"} text-center`}>
              <p className={`text-white font-bold break-words ${hasAnyMedia ? "text-base drop-shadow-lg" : "text-xl"}`}>{content}</p>
            </div>
          )}
          {!hasAnyMedia && !content && <p className="text-white/40 text-sm">معاينة القصة</p>}
        </div>

        {!hasAnyMedia && (
          <div className="px-3 py-2 flex gap-2 overflow-x-auto scrollbar-none border-b border-white/5">
            {BACKGROUNDS.map((b) => (
              <button key={b} onClick={() => setBg(b)} style={{ background: b }}
                className={`h-9 w-9 rounded-full shrink-0 ring-2 transition ${bg === b ? "ring-white" : "ring-white/10"}`}
                aria-label="خلفية" />
            ))}
          </div>
        )}

        <div className="p-3 space-y-2">
          <div className="relative">
            <Type className="absolute right-3 top-3 h-4 w-4 text-white/40" />
            <textarea
              value={content} onChange={(e) => setContent(e.target.value.slice(0, 280))}
              placeholder="اكتب شيئاً..."
              rows={3}
              className="w-full rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 px-4 py-2.5 pe-10 outline-none focus:border-emerald-400/50 resize-none"
            />
            <div className="text-[10px] text-white/40 text-end">{content.length}/280</div>
          </div>

          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white/5 border border-white/10 text-white py-2.5 hover:bg-white/10 transition"
            >
              <ImageIcon className="h-4 w-4" /><Video className="h-4 w-4" />
              <span className="text-sm">{hasAnyMedia ? "تغيير الوسائط" : "إضافة صورة/فيديو"}</span>
            </button>
            {hasAnyMedia && (
              <button
                onClick={() => { pickFile(null); setExistingMediaUrl(null); setExistingMediaType(null); }}
                className="rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 px-3 py-2.5 text-sm hover:bg-rose-500/20"
              >
                إزالة
              </button>
            )}
          </div>

          <button
            onClick={submit}
            disabled={busy}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold py-3 hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{busy ? (isEdit ? "جاري التحديث..." : "جاري النشر...") : (isEdit ? "حفظ التعديلات" : "نشر القصة")}</span>
          </button>
          <p className="text-[10px] text-white/40 text-center">
            {isEdit ? "يمكنك التعديل طوال 24 ساعة من النشر" : "تختفي القصة تلقائياً بعد 24 ساعة"}
          </p>
        </div>
      </div>
      {/* no-op import marker to ensure tree-shake keeps helper available */}
      <span className="hidden">{invalidateStoryCache.name}</span>
    </div>
  );
}
