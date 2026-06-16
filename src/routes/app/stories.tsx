import { createFileRoute, useSearch } from "@tanstack/react-router";
import { StoriesBar } from "@/components/StoriesBar";
import { useActiveStories, useStoriesAutoRefresh } from "@/lib/use-stories";
import { AvatarFrame } from "@/components/AvatarFrame";
import { useState } from "react";
import { StoryViewer } from "@/components/StoryViewer";
import { CreateStoryDialog } from "@/components/CreateStoryDialog";
import { Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";

type Search = { user?: string };

export const Route = createFileRoute("/app/stories")({
  component: StoriesPage,
  validateSearch: (s: Record<string, unknown>): Search => ({
    user: typeof s.user === "string" ? s.user : undefined,
  }),
});

function StoriesPage() {
  const { user: openUser } = useSearch({ from: "/app/stories" });
  const stories = useActiveStories();
  useStoriesAutoRefresh();
  const { session } = useAuth();
  const myId = session?.user?.id || "";
  const [creating, setCreating] = useState(false);
  const [viewer, setViewer] = useState<string | null>(openUser ?? null);

  return (
    <div className="px-3 py-4 space-y-4 text-white">
      <div className="rounded-3xl bg-gradient-to-br from-emerald-600/20 via-teal-600/10 to-cyan-600/20 border border-white/10 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-400" /> القصص</h1>
            <p className="text-xs text-white/70 mt-0.5">شارك لحظاتك مع الجميع لمدة 24 ساعة</p>
          </div>
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold px-4 py-2.5 shadow-lg shadow-emerald-500/30 active:scale-95">
            <Plus className="h-4 w-4" /> قصة جديدة
          </button>
        </div>
      </div>

      <StoriesBar />

      <div>
        <h2 className="text-sm font-bold text-white/80 px-1 mb-2">جميع القصص</h2>
        {stories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 p-8 text-center text-white/50">
            لا توجد قصص نشطة الآن. كن أول من ينشر قصة!
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {stories.map((u) => (
              <button key={u.user_id} onClick={() => setViewer(u.user_id)} className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                <span className={`relative inline-flex items-center justify-center rounded-full p-[2.5px] ${u.has_unseen ? "bg-[conic-gradient(from_0deg,#f59e0b,#ef4444,#ec4899,#8b5cf6,#3b82f6,#10b981,#f59e0b)]" : "bg-white/15"}`}>
                  <span className="block rounded-full bg-background p-[2px]">
                    <AvatarFrame userId={u.user_id} size="lg">
                      {u.avatar_url
                        ? <img src={u.avatar_url} className="h-14 w-14 rounded-full object-cover" alt="" />
                        : <div className="h-14 w-14 rounded-full bg-emerald-700 grid place-items-center text-white font-bold">{u.username?.[0] ?? "?"}</div>}
                    </AvatarFrame>
                  </span>
                </span>
                <span className="text-[11px] text-white truncate w-full text-center font-semibold">{u.user_id === myId ? "أنت" : (u.username || "مستخدم")}</span>
                <span className="text-[10px] text-white/50">{u.story_count} قصة</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <CreateStoryDialog open={creating} onClose={() => setCreating(false)} />
      {viewer && (
        <StoryViewer
          users={stories}
          initialUserId={viewer}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
