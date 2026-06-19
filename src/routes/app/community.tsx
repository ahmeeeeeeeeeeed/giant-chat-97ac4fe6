import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/lib/use-admin";
import { toast } from "sonner";
import { recordDailyAction } from "@/lib/daily-tasks";
import { AvatarFrame } from "@/components/AvatarFrame";
import { UserBadgesInline } from "@/components/UserBadges";
import { AiBadge } from "@/components/AiBadge";

import {
  ImagePlus, Video, X, Loader2, Send, MoreVertical, Trash2, Pencil,
  Flag, MessageCircle, Smile, Users, Sparkles, Bookmark, Share2, Link2,
  Filter, ArrowUpDown, TrendingUp, Clock, Star, Image as ImageIcon, Film,
  Hash, AtSign, Search, RefreshCw,
} from "lucide-react";


export const Route = createFileRoute("/app/community")({
  component: CommunityPage,
});

const db = supabase as any;

type Post = {
  id: string;
  author_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  kind: "text" | "image" | "video" | "mixed";
  created_at: string;
  edited: boolean;
  author?: { username: string | null; avatar_url: string | null; is_ai?: boolean };
  reactions_count?: number;
};

const REACTIONS: { key: string; emoji: string; label: string }[] = [
  { key: "like", emoji: "👍", label: "إعجاب" },
  { key: "love", emoji: "❤️", label: "حب" },
  { key: "haha", emoji: "😂", label: "ضحك" },
  { key: "wow",  emoji: "😮", label: "واو" },
  { key: "sad",  emoji: "😢", label: "حزن" },
  { key: "angry",emoji: "😡", label: "غضب" },
];

const QUICK_EMOJIS = ["😀","😂","🥰","😍","🤩","😎","🥳","🤔","😢","😡","🔥","✨","🎉","❤️","👍","🙏","💯","🌹","🌟","💎"];

type SortKey = "newest" | "trending" | "oldest";
type MediaFilter = "all" | "text" | "image" | "video";

function CommunityPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("newest");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [search, setSearch] = useState("");
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("community_saved") || "[]")); } catch { return new Set(); }
  });
  const [stats, setStats] = useState({ posts: 0, members: 0 });

  const load = async () => {
    setLoading(true);
    const { data, error } = await db
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const list: Post[] = data ?? [];
    const ids: string[] = Array.from(new Set(list.map((p) => p.author_id as string)));
    let map = new Map<string, { username: string | null; avatar_url: string | null; is_ai?: boolean }>();
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,username,avatar_url,is_ai").in("id", ids);
      profs?.forEach((p: any) => map.set(p.id, { username: p.username, avatar_url: p.avatar_url, is_ai: !!p.is_ai }));
    }

    // reaction counts
    const postIds = list.map(p => p.id);
    let rcounts = new Map<string, number>();
    if (postIds.length) {
      const { data: rx } = await db.from("community_reactions").select("post_id").in("post_id", postIds);
      (rx ?? []).forEach((r: any) => rcounts.set(r.post_id, (rcounts.get(r.post_id) ?? 0) + 1));
    }
    setPosts(list.map((p) => ({ ...p, author: map.get(p.author_id), reactions_count: rcounts.get(p.id) ?? 0 })));
    setStats({ posts: list.length, members: ids.length });
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("community-posts")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const toggleSaved = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem("community_saved", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const filtered = useMemo(() => {
    let arr = [...posts];
    if (showOnlyMine && user) arr = arr.filter(p => p.author_id === user.id);
    if (mediaFilter !== "all") {
      arr = arr.filter(p => {
        if (mediaFilter === "text") return !p.media_url;
        if (mediaFilter === "image") return p.media_type?.startsWith("image");
        if (mediaFilter === "video") return p.media_type?.startsWith("video");
        return true;
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(p => (p.content ?? "").toLowerCase().includes(q) || (p.author?.username ?? "").toLowerCase().includes(q));
    }
    if (sort === "trending") arr.sort((a,b) => (b.reactions_count ?? 0) - (a.reactions_count ?? 0));
    else if (sort === "oldest") arr.sort((a,b) => +new Date(a.created_at) - +new Date(b.created_at));
    else arr.sort((a,b) => +new Date(b.created_at) - +new Date(a.created_at));
    return arr;
  }, [posts, sort, mediaFilter, search, showOnlyMine, user]);

  if (!user) return null;

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-32 -end-24 h-72 w-72 rounded-full bg-gradient-to-br from-primary/40 via-fuchsia-500/25 to-transparent blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-40 -start-20 h-64 w-64 rounded-full bg-gradient-to-tr from-sky-500/30 via-emerald-400/20 to-transparent blur-3xl" />

      <header className="sticky top-0 z-20 overflow-hidden border-b border-white/10 bg-gradient-to-l from-primary/25 via-fuchsia-500/15 to-sky-500/20 px-4 py-4 backdrop-blur-xl">
        <div className="relative flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-lg shadow-primary/30">
            <Users className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="bg-gradient-to-l from-primary via-fuchsia-500 to-sky-500 bg-clip-text text-2xl font-extrabold text-transparent">
              المجتمع
            </h1>
            <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> {stats.posts} منشور</span>
              <span className="opacity-50">·</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3 text-fuchsia-500" /> {stats.members} عضو</span>
            </p>
          </div>
          <button onClick={load} title="تحديث" className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-foreground backdrop-blur transition hover:bg-white/10 active:scale-95">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في المنشورات…"
            className="h-10 w-full rounded-xl border border-white/10 bg-background/40 ps-9 pe-3 text-sm outline-none transition focus:border-primary focus:bg-background/70"
          />
        </div>

        {/* Filter chips */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <Chip active={sort === "newest"} onClick={() => setSort("newest")} icon={<Clock className="h-3 w-3" />}>الأحدث</Chip>
          <Chip active={sort === "trending"} onClick={() => setSort("trending")} icon={<TrendingUp className="h-3 w-3" />}>الأكثر تفاعلاً</Chip>
          <Chip active={sort === "oldest"} onClick={() => setSort("oldest")} icon={<ArrowUpDown className="h-3 w-3" />}>الأقدم</Chip>
          <span className="mx-1 h-5 w-px shrink-0 bg-white/15" />
          <Chip active={mediaFilter === "all"} onClick={() => setMediaFilter("all")} icon={<Filter className="h-3 w-3" />}>الكل</Chip>
          <Chip active={mediaFilter === "text"} onClick={() => setMediaFilter("text")} icon={<Pencil className="h-3 w-3" />}>نصوص</Chip>
          <Chip active={mediaFilter === "image"} onClick={() => setMediaFilter("image")} icon={<ImageIcon className="h-3 w-3" />}>صور</Chip>
          <Chip active={mediaFilter === "video"} onClick={() => setMediaFilter("video")} icon={<Film className="h-3 w-3" />}>فيديو</Chip>
          <span className="mx-1 h-5 w-px shrink-0 bg-white/15" />
          <Chip active={showOnlyMine} onClick={() => setShowOnlyMine(v => !v)} icon={<Star className="h-3 w-3" />}>منشوراتي</Chip>
        </div>
      </header>

      <div className="relative flex-1 px-3 py-4 space-y-4">
        <Composer userId={user.id} onPosted={load} />

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm text-muted-foreground backdrop-blur-xl">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
            {posts.length === 0 ? "لا توجد منشورات بعد — كن أول من ينشر!" : "لا توجد منشورات مطابقة"}
          </div>
        ) : (
          filtered.map((p) => (
            <PostCard
              key={p.id} post={p} currentUserId={user.id}
              saved={savedIds.has(p.id)}
              onToggleSaved={() => toggleSaved(p.id)}
              onChanged={load}
            />
          ))
        )}
      </div>
    </main>
  );
}

function Chip({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-bold transition active:scale-95 ${
        active
          ? "border-primary/40 bg-gradient-to-l from-primary/20 to-fuchsia-500/20 text-primary shadow-sm shadow-primary/20"
          : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10"
      }`}
    >
      {icon} {children}
    </button>
  );
}

function Composer({ userId, onPosted }: { userId: string; onPosted: () => void }) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const max = 4000;

  const pick = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const insertAtCursor = (txt: string) => {
    const el = textareaRef.current;
    if (!el) { setContent(c => c + txt); return; }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + txt + content.slice(end);
    setContent(next);
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + txt.length;
    }, 0);
  };

  const submit = async () => {
    if (!content.trim() && !file) { toast.error("اكتب شيئاً أو أرفق وسائط"); return; }
    setBusy(true);
    let media_url: string | null = null;
    let media_type: string | null = null;
    let kind: Post["kind"] = "text";
    try {
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("community").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("community").createSignedUrl(path, 60 * 60 * 24 * 365);
        media_url = signed?.signedUrl ?? null;
        media_type = file.type;
        kind = file.type.startsWith("video") ? (content.trim() ? "mixed" : "video")
             : file.type.startsWith("image") ? (content.trim() ? "mixed" : "image") : "text";
      }
      const { error } = await db.from("community_posts").insert({
        author_id: userId, content: content.trim() || null, media_url, media_type, kind,
      });
      if (error) throw error;
      setContent(""); pick(null); setShowEmoji(false);
      toast.success("تم نشر المنشور");
      recordDailyAction("publish_post" as any);
      onPosted();
    } catch (e: any) {
      toast.error(e.message || "فشل النشر");
    } finally { setBusy(false); }
  };

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-4 shadow-xl shadow-black/5 backdrop-blur-2xl space-y-3 transition hover:border-white/25">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-l from-transparent via-primary/60 to-transparent" />
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content} onChange={(e) => setContent(e.target.value.slice(0, max))}
          placeholder="✨ ما الذي تفكر فيه؟ استخدم # للوسوم و @ للذكر"
          rows={3}
          className="w-full resize-none rounded-2xl border border-white/10 bg-background/40 p-3 pb-7 text-sm outline-none transition focus:border-primary focus:bg-background/70 focus:ring-2 focus:ring-primary/20"
        />
        <span className={`absolute bottom-2 end-3 text-[10px] font-bold ${content.length > max - 200 ? "text-orange-500" : "text-muted-foreground"}`}>
          {content.length}/{max}
        </span>
      </div>

      {showEmoji && (
        <div className="grid grid-cols-10 gap-1 rounded-2xl border border-white/10 bg-background/40 p-2 backdrop-blur">
          {QUICK_EMOJIS.map(e => (
            <button key={e} type="button" onClick={() => insertAtCursor(e)}
              className="text-xl transition hover:scale-125 active:scale-95">{e}</button>
          ))}
        </div>
      )}

      {preview && file && (
        <div className="relative overflow-hidden rounded-2xl border border-white/15 shadow-lg">
          {file.type.startsWith("video")
            ? <video src={preview} controls className="max-h-64 w-full" />
            : <img src={preview} className="max-h-64 w-full object-cover" alt="" />}
          <button onClick={() => pick(null)}
            className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition hover:bg-black/90">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          <input ref={videoRef} type="file" accept="video/*" className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          <ComposerBtn onClick={() => fileRef.current?.click()} color="emerald"><ImagePlus className="h-4 w-4" /></ComposerBtn>
          <ComposerBtn onClick={() => videoRef.current?.click()} color="sky"><Video className="h-4 w-4" /></ComposerBtn>
          <ComposerBtn onClick={() => setShowEmoji(v => !v)} color="amber"><Smile className="h-4 w-4" /></ComposerBtn>
          <ComposerBtn onClick={() => insertAtCursor(" #")} color="fuchsia"><Hash className="h-4 w-4" /></ComposerBtn>
          <ComposerBtn onClick={() => insertAtCursor(" @")} color="violet"><AtSign className="h-4 w-4" /></ComposerBtn>
        </div>
        <button onClick={submit} disabled={busy}
          className="relative flex h-10 items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-l from-primary via-fuchsia-500 to-sky-500 px-5 text-sm font-bold text-white shadow-lg shadow-primary/30 transition hover:shadow-xl hover:shadow-primary/40 active:scale-95 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          نشر
        </button>
      </div>
    </div>
  );
}

const COMPOSER_COLORS: Record<string, string> = {
  emerald: "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
  sky: "border-sky-400/30 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300",
  amber: "border-amber-400/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300",
  fuchsia: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-700 hover:bg-fuchsia-500/20 dark:text-fuchsia-300",
  violet: "border-violet-400/30 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300",
};
function ComposerBtn({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} type="button"
      className={`grid h-9 w-9 place-items-center rounded-xl border backdrop-blur transition active:scale-95 ${COMPOSER_COLORS[color]}`}>
      {children}
    </button>
  );
}

const MAX_PREVIEW = 280;

/** Render content with hashtags and mentions highlighted */
function RichContent({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((part, i) => {
        if (/^#[\p{L}\p{N}_]+/u.test(part))
          return <span key={i} className="font-bold text-fuchsia-500 hover:underline cursor-pointer">{part}</span>;
        if (/^@[\p{L}\p{N}_]+/u.test(part))
          return <span key={i} className="font-bold text-sky-500 hover:underline cursor-pointer">{part}</span>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function timeAgo(iso: string) {
  const diff = (Date.now() - +new Date(iso)) / 1000;
  if (diff < 60) return "الآن";
  if (diff < 3600) return `قبل ${Math.floor(diff/60)} د`;
  if (diff < 86400) return `قبل ${Math.floor(diff/3600)} س`;
  if (diff < 604800) return `قبل ${Math.floor(diff/86400)} ي`;
  return new Date(iso).toLocaleDateString("ar");
}

function PostCard({ post, currentUserId, saved, onToggleSaved, onChanged }: {
  post: Post; currentUserId: string; saved: boolean; onToggleSaved: () => void; onChanged: () => void;
}) {
  const { isAdmin } = useIsAdmin();
  const isOwner = post.author_id === currentUserId;
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const [reactions, setReactions] = useState<{ reaction: string; user_id: string }[]>([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const myReaction = reactions.find(r => r.user_id === currentUserId)?.reaction;

  const loadReactions = async () => {
    const { data } = await db.from("community_reactions").select("reaction,user_id").eq("post_id", post.id);
    setReactions(data ?? []);
  };
  const loadCommentsCount = async () => {
    const { count } = await db.from("community_comments").select("*", { count: "exact", head: true }).eq("post_id", post.id);
    setCommentsCount(count ?? 0);
  };
  useEffect(() => {
    loadReactions(); loadCommentsCount();
    const ch = supabase.channel(`react-${post.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_reactions", filter: `post_id=eq.${post.id}` }, loadReactions)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_comments", filter: `post_id=eq.${post.id}` }, loadCommentsCount)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [post.id]);

  const react = async (key: string) => {
    if (myReaction === key) {
      await db.from("community_reactions").delete().eq("post_id", post.id).eq("user_id", currentUserId);
    } else if (myReaction) {
      await db.from("community_reactions").update({ reaction: key }).eq("post_id", post.id).eq("user_id", currentUserId);
    } else {
      await db.from("community_reactions").insert({ post_id: post.id, user_id: currentUserId, reaction: key });
      try { await db.rpc("record_daily_action", { _kind: "react_messages", _amount: 1 }); } catch { /* ignore */ }
    }
    setShowReactions(false);
  };

  const saveEdit = async () => {
    const { error } = await db.from("community_posts").update({ content: editText.trim() || null }).eq("id", post.id);
    if (error) toast.error(error.message); else { toast.success("تم التعديل"); setEditing(false); onChanged(); }
  };

  const del = async () => {
    if (!confirm("حذف هذا المنشور؟")) return;
    const rpcOrDel = isAdmin && !isOwner
      ? await db.rpc("admin_delete_post", { _post: post.id })
      : await db.from("community_posts").delete().eq("id", post.id);
    if (rpcOrDel.error) toast.error(rpcOrDel.error.message); else { toast.success("تم الحذف"); onChanged(); }
  };

  const report = async () => {
    const reason = prompt("سبب الإبلاغ؟", "محتوى غير لائق");
    if (!reason) return;
    const { error } = await db.from("community_reports").insert({ post_id: post.id, reporter_id: currentUserId, reason });
    if (error) toast.error(error.message); else toast.success("تم إرسال البلاغ");
    setMenuOpen(false);
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/app/community#post-${post.id}`;
    try { await navigator.clipboard.writeText(url); toast.success("تم نسخ الرابط"); }
    catch { toast.error("فشل النسخ"); }
    setMenuOpen(false);
  };

  const share = async () => {
    const url = `${window.location.origin}/app/community#post-${post.id}`;
    const text = post.content?.slice(0, 100) || "منشور من Giant Chat";
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: "Giant Chat", text, url }); return; } catch {}
    }
    copyLink();
  };

  const content = post.content || "";
  const isLong = content.length > MAX_PREVIEW;
  const shown = expanded || !isLong ? content : content.slice(0, MAX_PREVIEW) + "…";

  const reactionCounts = REACTIONS.map(r => ({
    ...r, count: reactions.filter(x => x.reaction === r.key).length,
  })).filter(r => r.count > 0);
  const total = reactions.length;

  return (
    <article id={`post-${post.id}`} className="group relative overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-4 shadow-lg shadow-black/5 backdrop-blur-2xl space-y-3 transition hover:border-white/25 hover:shadow-xl">
      <div aria-hidden className="pointer-events-none absolute inset-x-4 -top-px h-px bg-gradient-to-l from-transparent via-primary/40 to-transparent" />
      <header className="flex items-center justify-between">
        <Link to="/app/profile/$id" params={{ id: post.author_id }} className="flex min-w-0 items-center gap-2.5">
          <AvatarFrame userId={post.author_id} size="md">
            {post.author?.avatar_url
              ? <img src={post.author.avatar_url} className="h-10 w-10 rounded-full object-cover" alt="" />
              : <div className="h-10 w-10 rounded-full bg-secondary" />}
          </AvatarFrame>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="truncate text-sm font-bold">{post.author?.username || "مستخدم"}</div>
              {post.author?.is_ai && <AiBadge />}
              <UserBadgesInline userId={post.author_id} max={2} />
            </div>

            <div className="text-[11px] text-muted-foreground">
              {timeAgo(post.created_at)}{post.edited ? " · معدّل" : ""}
            </div>
          </div>
        </Link>
        <div className="relative">
          <button onClick={() => setMenuOpen(v => !v)} className="rounded-full p-1.5 hover:bg-secondary">
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div className="absolute end-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
              <MenuItem icon={<Link2 className="h-4 w-4" />} onClick={copyLink}>نسخ الرابط</MenuItem>
              <MenuItem icon={<Share2 className="h-4 w-4" />} onClick={() => { share(); setMenuOpen(false); }}>مشاركة</MenuItem>
              <MenuItem icon={<Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />} onClick={() => { onToggleSaved(); setMenuOpen(false); }}>{saved ? "إلغاء الحفظ" : "حفظ"}</MenuItem>
              {isOwner && (
                <MenuItem icon={<Pencil className="h-4 w-4" />} onClick={() => { setEditing(true); setMenuOpen(false); }}>تعديل</MenuItem>
              )}
              {(isOwner || isAdmin) && (
                <MenuItem icon={<Trash2 className="h-4 w-4" />} onClick={del} danger>حذف</MenuItem>
              )}
              {!isOwner && (
                <MenuItem icon={<Flag className="h-4 w-4" />} onClick={report}>إبلاغ</MenuItem>
              )}
            </div>
          )}
        </div>
      </header>

      {editing ? (
        <div className="space-y-2">
          <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3}
            className="w-full rounded-xl border border-input bg-background p-2 text-sm outline-none focus:border-primary" />
          <div className="flex gap-2">
            <button onClick={saveEdit} className="flex-1 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground">حفظ</button>
            <button onClick={() => { setEditing(false); setEditText(post.content || ""); }}
              className="flex-1 rounded-xl bg-secondary py-2 text-sm">إلغاء</button>
          </div>
        </div>
      ) : (
        <>
          {content && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              <RichContent text={shown} />
              {isLong && (
                <button onClick={() => setExpanded(v => !v)} className="ms-1 text-primary text-xs font-semibold">
                  {expanded ? "عرض أقل" : "قراءة المزيد"}
                </button>
              )}
            </div>
          )}
          {post.media_url && (
            <div className="overflow-hidden rounded-2xl border border-white/10 shadow-lg">
              {post.media_type?.startsWith("video")
                ? <video src={post.media_url} controls className="w-full max-h-[480px]" />
                : <img src={post.media_url} className="w-full max-h-[480px] object-contain bg-black" alt="" />}
            </div>
          )}
        </>
      )}

      <div className="flex items-center gap-1.5 border-t border-white/10 pt-3">
        <div className="relative">
          <button
            onMouseEnter={() => setShowReactions(true)}
            onClick={() => react(myReaction || "like")}
            className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold backdrop-blur transition active:scale-95 ${
              myReaction
                ? "border-primary/40 bg-gradient-to-l from-primary/20 to-fuchsia-500/20 text-primary shadow-sm shadow-primary/20"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            {myReaction ? REACTIONS.find(r => r.key === myReaction)?.emoji : <Smile className="h-4 w-4" />}
            <span>{myReaction ? REACTIONS.find(r => r.key === myReaction)?.label : "تفاعل"}</span>
          </button>
          {showReactions && (
            <div onMouseLeave={() => setShowReactions(false)}
              className="absolute bottom-full start-0 mb-2 flex items-center gap-1 rounded-full border border-white/20 bg-popover/90 p-1.5 shadow-2xl backdrop-blur-xl z-30">
              {REACTIONS.map(r => (
                <button key={r.key} title={r.label} onClick={() => react(r.key)}
                  className="text-2xl transition hover:scale-150 hover:-translate-y-1">{r.emoji}</button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setShowComments(v => !v)}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold backdrop-blur transition hover:bg-white/10 active:scale-95">
          <MessageCircle className="h-4 w-4" /> {commentsCount > 0 ? commentsCount : "تعليق"}
        </button>
        <button onClick={share} title="مشاركة"
          className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 backdrop-blur transition hover:bg-white/10 active:scale-95">
          <Share2 className="h-4 w-4" />
        </button>
        <button onClick={onToggleSaved} title={saved ? "إلغاء الحفظ" : "حفظ"}
          className={`grid h-9 w-9 place-items-center rounded-xl border backdrop-blur transition active:scale-95 ${
            saved ? "border-amber-400/40 bg-amber-400/20 text-amber-500" : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}>
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
        </button>
        <div className="ms-auto flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
          {reactionCounts.slice(0, 3).map(r => <span key={r.key}>{r.emoji}</span>)}
          {total > 0 && <span className="ms-1 font-bold text-foreground">{total}</span>}
        </div>
      </div>

      {showComments && <Comments postId={post.id} postAuthorId={post.author_id} currentUserId={currentUserId} isAdmin={isAdmin} />}
    </article>
  );
}

function MenuItem({ icon, onClick, danger, children }: { icon: React.ReactNode; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition hover:bg-secondary ${danger ? "text-destructive" : ""}`}>
      {icon} {children}
    </button>
  );
}

function Comments({ postId, postAuthorId, currentUserId, isAdmin }: {
  postId: string; postAuthorId: string; currentUserId: string; isAdmin: boolean;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await db.from("community_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    const ids: string[] = Array.from(new Set((data ?? []).map((c: any) => c.author_id as string)));
    let map = new Map<string, any>();
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,username,avatar_url").in("id", ids);
      profs?.forEach((p: any) => map.set(p.id, p));
    }
    setItems((data ?? []).map((c: any) => ({ ...c, author: map.get(c.author_id) })));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`comm-${postId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_comments", filter: `post_id=eq.${postId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId]);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const { error } = await db.from("community_comments").insert({ post_id: postId, author_id: currentUserId, content: text.trim() });
    setBusy(false);
    if (error) toast.error(error.message); else setText("");
  };

  const del = async (id: string) => {
    const { error } = await db.from("community_comments").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <div className="mt-1 space-y-2 border-t border-white/10 pt-3">
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {items.map((c) => {
          const canDel = c.author_id === currentUserId || isAdmin || currentUserId === postAuthorId;
          return (
            <div key={c.id} className="flex items-start gap-2">
              <AvatarFrame userId={c.author_id} size="sm">
                {c.author?.avatar_url
                  ? <img src={c.author.avatar_url} className="h-7 w-7 rounded-full object-cover" alt="" />
                  : <div className="h-7 w-7 rounded-full bg-secondary" />}
              </AvatarFrame>
              <div className="flex-1 rounded-2xl bg-secondary/50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="text-xs font-bold">{c.author?.username || "مستخدم"}</div>
                    <UserBadgesInline userId={c.author_id} max={1} />
                  </div>
                  {canDel && (
                    <button onClick={() => del(c.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="text-sm whitespace-pre-wrap"><RichContent text={c.content} /></div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <div className="py-3 text-center text-xs text-muted-foreground">لا توجد تعليقات بعد — كن أول من يعلّق</div>}
      </div>
      <div className="flex items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="اكتب تعليقاً…"
          className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
        <button onClick={submit} disabled={busy || !text.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
