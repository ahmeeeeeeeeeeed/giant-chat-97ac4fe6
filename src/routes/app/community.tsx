import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/lib/use-admin";
import { toast } from "sonner";
import { recordDailyAction } from "@/lib/daily-tasks";
import {
  ImagePlus, Video, X, Loader2, Send, MoreVertical, Trash2, Pencil,
  Flag, MessageCircle, ChevronDown, ChevronUp, Heart, Smile,
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
  author?: { username: string | null; avatar_url: string | null };
};

const REACTIONS: { key: string; emoji: string; label: string }[] = [
  { key: "like", emoji: "👍", label: "إعجاب" },
  { key: "love", emoji: "❤️", label: "حب" },
  { key: "haha", emoji: "😂", label: "ضحك" },
  { key: "wow",  emoji: "😮", label: "واو" },
  { key: "sad",  emoji: "😢", label: "حزن" },
  { key: "angry",emoji: "😡", label: "غضب" },
];

function CommunityPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await db
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const ids: string[] = Array.from(new Set((data ?? []).map((p: Post) => p.author_id as string)));
    let map = new Map<string, { username: string | null; avatar_url: string | null }>();
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,username,avatar_url").in("id", ids);
      profs?.forEach((p: any) => map.set(p.id, { username: p.username, avatar_url: p.avatar_url }));
    }
    setPosts((data ?? []).map((p: Post) => ({ ...p, author: map.get(p.author_id) })));
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

  if (!user) return null;

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <h1 className="text-2xl font-extrabold">المجتمع</h1>
        <p className="text-xs text-muted-foreground">شارك صورة، فيديو، أو منشور كتابي</p>
      </header>

      <div className="flex-1 px-3 py-3 space-y-3">
        <Composer userId={user.id} onPosted={load} />

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : posts.length === 0 ? (
          <div className="mt-12 text-center text-sm text-muted-foreground">لا توجد منشورات بعد — كن أول من ينشر!</div>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} currentUserId={user.id} onChanged={load} />)
        )}
      </div>
    </main>
  );
}

function Composer({ userId, onPosted }: { userId: string; onPosted: () => void }) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
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
      setContent(""); pick(null);
      toast.success("تم نشر المنشور");
      onPosted();
    } catch (e: any) {
      toast.error(e.message || "فشل النشر");
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
      <textarea
        value={content} onChange={(e) => setContent(e.target.value)}
        placeholder="ما الذي تفكر فيه؟" rows={3} maxLength={4000}
        className="w-full resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary"
      />
      {preview && file && (
        <div className="relative overflow-hidden rounded-xl border border-border">
          {file.type.startsWith("video")
            ? <video src={preview} controls className="max-h-64 w-full" />
            : <img src={preview} className="max-h-64 w-full object-cover" alt="" />}
          <button onClick={() => pick(null)}
            className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          <input ref={videoRef} type="file" accept="video/*" className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          <button onClick={() => fileRef.current?.click()}
            className="flex h-9 items-center gap-1 rounded-xl bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <ImagePlus className="h-4 w-4" /> صورة
          </button>
          <button onClick={() => videoRef.current?.click()}
            className="flex h-9 items-center gap-1 rounded-xl bg-blue-500/10 px-3 text-xs font-semibold text-blue-700 dark:text-blue-400">
            <Video className="h-4 w-4" /> فيديو
          </button>
        </div>
        <button onClick={submit} disabled={busy}
          className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          نشر
        </button>
      </div>
    </div>
  );
}

const MAX_PREVIEW = 280;

function PostCard({ post, currentUserId, onChanged }: { post: Post; currentUserId: string; onChanged: () => void }) {
  const { isAdmin } = useIsAdmin();
  const isOwner = post.author_id === currentUserId;
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const [reactions, setReactions] = useState<{ reaction: string; user_id: string }[]>([]);
  const myReaction = reactions.find(r => r.user_id === currentUserId)?.reaction;

  const loadReactions = async () => {
    const { data } = await db.from("community_reactions").select("reaction,user_id").eq("post_id", post.id);
    setReactions(data ?? []);
  };
  useEffect(() => {
    loadReactions();
    const ch = supabase.channel(`react-${post.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_reactions", filter: `post_id=eq.${post.id}` }, loadReactions)
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

  const content = post.content || "";
  const isLong = content.length > MAX_PREVIEW;
  const shown = expanded || !isLong ? content : content.slice(0, MAX_PREVIEW) + "…";

  const reactionCounts = REACTIONS.map(r => ({
    ...r, count: reactions.filter(x => x.reaction === r.key).length,
  })).filter(r => r.count > 0);
  const total = reactions.length;

  return (
    <article className="rounded-2xl border border-border bg-card p-3 space-y-2">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {post.author?.avatar_url
            ? <img src={post.author.avatar_url} className="h-9 w-9 rounded-full object-cover" alt="" />
            : <div className="h-9 w-9 rounded-full bg-secondary" />}
          <div>
            <div className="text-sm font-bold">{post.author?.username || "مستخدم"}</div>
            <div className="text-[11px] text-muted-foreground">
              {new Date(post.created_at).toLocaleString("ar")}{post.edited ? " · معدّل" : ""}
            </div>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setMenuOpen(v => !v)} className="rounded-full p-1.5 hover:bg-secondary">
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div className="absolute end-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
              {(isOwner) && (
                <button onClick={() => { setEditing(true); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary">
                  <Pencil className="h-4 w-4" /> تعديل
                </button>
              )}
              {(isOwner || isAdmin) && (
                <button onClick={del}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-secondary">
                  <Trash2 className="h-4 w-4" /> حذف
                </button>
              )}
              {!isOwner && (
                <button onClick={report}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary">
                  <Flag className="h-4 w-4" /> إبلاغ
                </button>
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
              {shown}
              {isLong && (
                <button onClick={() => setExpanded(v => !v)} className="ms-1 text-primary text-xs font-semibold">
                  {expanded ? "عرض أقل" : "قراءة المزيد"}
                </button>
              )}
            </div>
          )}
          {post.media_url && (
            <div className="overflow-hidden rounded-xl border border-border">
              {post.media_type?.startsWith("video")
                ? <video src={post.media_url} controls className="w-full max-h-[480px]" />
                : <img src={post.media_url} className="w-full max-h-[480px] object-contain bg-black" alt="" />}
            </div>
          )}
        </>
      )}

      <div className="flex items-center gap-2 border-t border-border pt-2">
        <div className="relative">
          <button
            onMouseEnter={() => setShowReactions(true)}
            onClick={() => react(myReaction || "like")}
            className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition ${
              myReaction ? "bg-primary/15 text-primary" : "bg-secondary hover:bg-secondary/70"
            }`}
          >
            {myReaction ? REACTIONS.find(r => r.key === myReaction)?.emoji : <Smile className="h-4 w-4" />}
            <span>{myReaction ? REACTIONS.find(r => r.key === myReaction)?.label : "تفاعل"}</span>
          </button>
          {showReactions && (
            <div onMouseLeave={() => setShowReactions(false)}
              className="absolute bottom-full start-0 mb-2 flex items-center gap-1 rounded-full border border-border bg-popover p-1.5 shadow-xl z-30">
              {REACTIONS.map(r => (
                <button key={r.key} title={r.label} onClick={() => react(r.key)}
                  className="text-2xl transition hover:scale-125">{r.emoji}</button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setShowComments(v => !v)}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-secondary px-3 text-xs font-bold hover:bg-secondary/70">
          <MessageCircle className="h-4 w-4" /> تعليق
        </button>
        <div className="ms-auto flex items-center gap-1 text-xs text-muted-foreground">
          {reactionCounts.slice(0, 3).map(r => <span key={r.key}>{r.emoji}</span>)}
          {total > 0 && <span className="ms-1">{total}</span>}
        </div>
      </div>

      {showComments && <Comments postId={post.id} postAuthorId={post.author_id} currentUserId={currentUserId} isAdmin={isAdmin} />}
    </article>
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
    <div className="mt-1 space-y-2 border-t border-border pt-2">
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {items.map((c) => {
          const canDel = c.author_id === currentUserId || isAdmin || currentUserId === postAuthorId;
          return (
            <div key={c.id} className="flex items-start gap-2">
              {c.author?.avatar_url
                ? <img src={c.author.avatar_url} className="h-7 w-7 rounded-full object-cover" alt="" />
                : <div className="h-7 w-7 rounded-full bg-secondary" />}
              <div className="flex-1 rounded-xl bg-secondary/50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold">{c.author?.username || "مستخدم"}</div>
                  {canDel && (
                    <button onClick={() => del(c.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="text-sm whitespace-pre-wrap">{c.content}</div>
              </div>
            </div>
          );
        })}
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
