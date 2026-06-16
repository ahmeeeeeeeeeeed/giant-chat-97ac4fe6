import { useState } from "react";
import { Plus } from "lucide-react";
import { useActiveStories, useStoriesAutoRefresh, type StoryUser } from "@/lib/use-stories";
import { AvatarFrame } from "@/components/AvatarFrame";
import { CreateStoryDialog } from "@/components/CreateStoryDialog";
import { StoryViewer } from "@/components/StoryViewer";
import { useAuth } from "@/lib/auth";

export function StoriesBar({ autoOpen }: { autoOpen?: string | null }) {
  const stories = useActiveStories();
  useStoriesAutoRefresh();
  const { session } = useAuth();
  const myId = session?.user?.id || "";
  const [creating, setCreating] = useState(false);
  const [viewer, setViewer] = useState<string | null>(autoOpen ?? null);

  const meHasStory = stories.some((s) => s.user_id === myId);
  const ordered: StoryUser[] = [
    ...stories.filter((s) => s.user_id === myId),
    ...stories.filter((s) => s.user_id !== myId),
  ];

  return (
    <>
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-none px-3 py-3">
        {/* Create */}
        <button onClick={() => setCreating(true)} className="flex flex-col items-center gap-1 shrink-0">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center text-white shadow-lg shadow-emerald-500/30">
              <Plus className="h-7 w-7" strokeWidth={3} />
            </div>
          </div>
          <span className="text-[11px] text-white/80 font-semibold">قصتك</span>
        </button>

        {/* My story (if any) - shown first */}
        {!meHasStory && (
          <div className="h-12 w-px bg-white/10 shrink-0" />
        )}

        {ordered.map((u) => (
          <button key={u.user_id} onClick={() => setViewer(u.user_id)} className="flex flex-col items-center gap-1 shrink-0 max-w-[72px]">
            <span className={`relative inline-flex items-center justify-center rounded-full p-[2.5px] ${u.has_unseen ? "bg-[conic-gradient(from_0deg,#f59e0b,#ef4444,#ec4899,#8b5cf6,#3b82f6,#10b981,#f59e0b)]" : "bg-white/15"}`}>
              <span className="block rounded-full bg-background p-[2px]">
                <AvatarFrame userId={u.user_id} size="lg">
                  {u.avatar_url
                    ? <img src={u.avatar_url} className="h-14 w-14 rounded-full object-cover" alt="" />
                    : <div className="h-14 w-14 rounded-full bg-emerald-700 grid place-items-center text-white font-bold">{u.username?.[0] ?? "?"}</div>}
                </AvatarFrame>
              </span>
            </span>
            <span className="text-[11px] text-white/80 truncate w-full text-center">{u.user_id === myId ? "أنت" : (u.username || "مستخدم")}</span>
          </button>
        ))}

        {stories.length === 0 && (
          <div className="text-white/40 text-sm py-3 px-2">لا توجد قصص نشطة. كن أول من ينشر قصة!</div>
        )}
      </div>

      <CreateStoryDialog open={creating} onClose={() => setCreating(false)} />
      {viewer && (
        <StoryViewer
          users={ordered.length ? ordered : stories}
          initialUserId={viewer}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  );
}
