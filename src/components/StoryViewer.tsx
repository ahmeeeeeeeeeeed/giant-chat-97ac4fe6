import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Trash2, Eye } from "lucide-react";
import { AvatarFrame } from "@/components/AvatarFrame";
import { fetchUserStories, viewStory, deleteStory, type StoryRow, type StoryUser } from "@/lib/use-stories";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DURATION_MS = 5000;

export function StoryViewer({
  users,
  initialUserId,
  onClose,
}: {
  users: StoryUser[];
  initialUserId: string;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const myId = session?.user?.id || "";
  const [userIdx, setUserIdx] = useState(() => Math.max(0, users.findIndex((u) => u.user_id === initialUserId)));
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState<{ viewer_id: string; viewed_at: string; username: string | null; avatar_url: string | null }[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  const currentUser = users[userIdx];
  const currentStory = stories[storyIdx];

  useEffect(() => {
    if (!currentUser) return;
    setStoryIdx(0);
    setStories([]);
    fetchUserStories(currentUser.user_id).then((s) => setStories(s));
  }, [currentUser?.user_id]);

  useEffect(() => {
    if (!currentStory) return;
    void viewStory(currentStory.id);
    elapsedRef.current = 0;
    setProgress(0);
  }, [currentStory?.id]);

  // load viewers when own story
  useEffect(() => {
    if (!currentStory || currentUser?.user_id !== myId) { setViewers([]); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from("story_views")
        .select("viewer_id, viewed_at, profiles:viewer_id(username, avatar_url)")
        .eq("story_id", currentStory.id)
        .order("viewed_at", { ascending: false });
      setViewers(((data as any[]) || []).map((r) => ({
        viewer_id: r.viewer_id, viewed_at: r.viewed_at,
        username: r.profiles?.username ?? null, avatar_url: r.profiles?.avatar_url ?? null,
      })));
    })();
  }, [currentStory?.id, currentUser?.user_id, myId]);

  const next = () => {
    if (storyIdx + 1 < stories.length) setStoryIdx(storyIdx + 1);
    else if (userIdx + 1 < users.length) setUserIdx(userIdx + 1);
    else onClose();
  };
  const prev = () => {
    if (storyIdx > 0) setStoryIdx(storyIdx - 1);
    else if (userIdx > 0) setUserIdx(userIdx - 1);
  };

  useEffect(() => {
    if (!currentStory || paused) return;
    startRef.current = performance.now();
    const tick = (now: number) => {
      const dt = now - startRef.current;
      const total = elapsedRef.current + dt;
      const p = Math.min(100, (total / DURATION_MS) * 100);
      setProgress(p);
      if (p >= 100) { next(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      elapsedRef.current += performance.now() - startRef.current;
    };
  }, [currentStory?.id, paused, storyIdx, userIdx, stories.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") prev();
      else if (e.key === "ArrowLeft") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const handleDelete = async () => {
    if (!currentStory) return;
    if (!confirm("حذف القصة؟")) return;
    try {
      await deleteStory(currentStory.id);
      toast.success("تم حذف القصة");
      const remaining = stories.filter((s) => s.id !== currentStory.id);
      if (remaining.length === 0) { onClose(); return; }
      setStories(remaining);
      setStoryIdx(Math.min(storyIdx, remaining.length - 1));
    } catch (e: any) { toast.error(e.message || "فشل الحذف"); }
  };

  if (!currentUser) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center">
      <div className="relative w-full h-full max-w-md mx-auto flex flex-col">
        {/* progress bars */}
        <div className="absolute top-0 inset-x-0 z-30 flex gap-1 p-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden">
              <div className="h-full bg-white transition-[width] duration-100"
                style={{ width: i < storyIdx ? "100%" : i === storyIdx ? `${progress}%` : "0%" }} />
            </div>
          ))}
        </div>

        {/* header */}
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between gap-2 px-3 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
          <div className="flex items-center gap-2 min-w-0">
            <AvatarFrame userId={currentUser.user_id} size="sm">
              {currentUser.avatar_url
                ? <img src={currentUser.avatar_url} className="h-8 w-8 rounded-full object-cover" alt="" />
                : <div className="h-8 w-8 rounded-full bg-emerald-700 grid place-items-center text-white text-xs font-bold">{currentUser.username?.[0] ?? "?"}</div>}
            </AvatarFrame>
            <div className="min-w-0">
              <div className="text-white text-sm font-semibold truncate">{currentUser.username || "مستخدم"}</div>
              <div className="text-white/60 text-[10px]">{currentStory ? new Date(currentStory.created_at).toLocaleString("ar") : ""}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {currentUser.user_id === myId && currentStory && (
              <button onClick={handleDelete} className="h-9 w-9 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="حذف">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="h-9 w-9 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="إغلاق">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* content */}
        <div
          className="relative flex-1 flex items-center justify-center"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
        >
          {currentStory ? (
            <div
              className="w-full h-full flex items-center justify-center relative"
              style={currentStory.media_url ? {} : { background: currentStory.background || "linear-gradient(135deg,#0f172a,#1e293b)" }}
            >
              {currentStory.media_url && currentStory.media_type === "image" && (
                <img src={currentStory.media_url} className="max-w-full max-h-full object-contain" alt="" />
              )}
              {currentStory.media_url && currentStory.media_type === "video" && (
                <video src={currentStory.media_url} className="max-w-full max-h-full object-contain" autoPlay playsInline muted={false} />
              )}
              {currentStory.content && (
                <div className={`${currentStory.media_url ? "absolute inset-x-0 bottom-24 px-6" : "px-6"} text-center`}>
                  <p className={`text-white font-bold leading-snug ${currentStory.media_url ? "text-lg drop-shadow-lg" : "text-2xl"} break-words`}>{currentStory.content}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-white/60">…</div>
          )}

          {/* nav zones */}
          <button onClick={prev} className="absolute inset-y-0 right-0 w-1/3" aria-label="السابق" />
          <button onClick={next} className="absolute inset-y-0 left-0 w-1/3" aria-label="التالي" />
        </div>

        {/* footer (own story → viewers) */}
        {currentUser.user_id === myId && currentStory && (
          <div className="absolute bottom-0 inset-x-0 z-20 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            <button
              onClick={() => setShowViewers((v) => !v)}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-2 text-white text-sm hover:bg-white/20"
            >
              <Eye className="h-4 w-4" />
              <span>المشاهدون ({viewers.length})</span>
            </button>
            {showViewers && (
              <div className="mt-2 max-h-64 overflow-auto rounded-2xl bg-slate-900/90 border border-white/10 p-2 space-y-1">
                {viewers.length === 0 && <div className="text-white/50 text-center py-4 text-sm">لا أحد بعد</div>}
                {viewers.map((v) => (
                  <div key={v.viewer_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5">
                    {v.avatar_url
                      ? <img src={v.avatar_url} className="h-7 w-7 rounded-full object-cover" alt="" />
                      : <div className="h-7 w-7 rounded-full bg-emerald-700 grid place-items-center text-white text-[10px] font-bold">{v.username?.[0] ?? "?"}</div>}
                    <span className="text-white text-sm flex-1 truncate">{v.username || "مستخدم"}</span>
                    <span className="text-white/40 text-[10px]">{new Date(v.viewed_at).toLocaleTimeString("ar")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* prev/next chevrons (visible hint) */}
        {userIdx > 0 && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"><ChevronRight className="h-6 w-6" /></div>
        )}
        {userIdx < users.length - 1 && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"><ChevronLeft className="h-6 w-6" /></div>
        )}
      </div>
    </div>
  );
}
