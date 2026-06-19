import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useIsAdmin } from "@/lib/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  createAiPersona,
  updateAiPersona,
  deleteAiPersona,
  addPersonaTemplate,
  deletePersonaTemplate,
  runPersonaCycle,
} from "@/lib/ai-personas.functions";
import { Bot, Loader2, Plus, Trash2, Play, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { AiBadge } from "@/components/AiBadge";

export const Route = createFileRoute("/app/admin/ai-personas")({
  component: AdminAiPersonas,
});

const db = supabase as any;

function AdminAiPersonas() {
  const { isAdmin, loaded } = useIsAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"personas" | "templates" | "log">("personas");
  const [personas, setPersonas] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const createFn = useServerFn(createAiPersona);
  const updateFn = useServerFn(updateAiPersona);
  const deleteFn = useServerFn(deleteAiPersona);
  const addTplFn = useServerFn(addPersonaTemplate);
  const delTplFn = useServerFn(deletePersonaTemplate);
  const cycleFn = useServerFn(runPersonaCycle);

  useEffect(() => {
    if (loaded && !isAdmin) {
      toast.error("للمسؤولين فقط");
      navigate({ to: "/app" });
    }
  }, [loaded, isAdmin, navigate]);

  const load = async () => {
    setLoading(true);
    const [{ data: ps }, { data: ts }, { data: lg }] = await Promise.all([
      db.from("ai_personas").select("*").order("created_at", { ascending: false }),
      db.from("ai_persona_templates").select("*").order("created_at", { ascending: false }),
      db.from("ai_persona_activity_log").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setPersonas(ps || []);
    setTemplates(ts || []);
    setLog(lg || []);
    setLoading(false);
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!loaded || !isAdmin) return null;

  const runCycle = async () => {
    setBusy(true);
    try {
      const r = await cycleFn({});
      toast.success(`تم تشغيل دورة (${(r as any)?.processed ?? 0})`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل");
    } finally { setBusy(false); }
  };

  const toggleActive = async (p: any) => {
    try {
      await updateFn({ data: { id: p.id, patch: { is_active: !p.is_active } } });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
  };

  const removePersona = async (id: string) => {
    if (!confirm("حذف الشخصية والحساب نهائياً؟")) return;
    try { await deleteFn({ data: { id } }); toast.success("تم الحذف"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
  };

  return (
    <main className="flex flex-1 flex-col p-4 gap-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-cyan-600" />
          <div>
            <h1 className="text-xl font-extrabold">الحسابات الافتراضية (AI)</h1>
            <p className="text-xs text-muted-foreground">إدارة الشخصيات والقوالب وسجل النشاط</p>
          </div>
        </div>
        <button onClick={runCycle} disabled={busy}
          className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          تشغيل دورة الآن
        </button>
      </header>

      <div className="flex gap-2">
        {(["personas", "templates", "log"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 h-10 rounded-xl text-sm font-bold ${tab === t ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
            {t === "personas" ? `الشخصيات (${personas.length})` : t === "templates" ? `القوالب (${templates.length})` : `السجل`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : tab === "personas" ? (
        <div className="space-y-2">
          <button onClick={() => setShowNew(true)}
            className="flex h-11 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-card text-sm font-bold">
            <Plus className="h-4 w-4" /> شخصية جديدة
          </button>
          {personas.map((p) => (
            <PersonaCard
              key={p.id} p={p}
              onToggle={() => toggleActive(p)}
              onDelete={() => removePersona(p.id)}
              onSave={async (patch: any) => {
                try { await updateFn({ data: { id: p.id, patch } }); toast.success("تم الحفظ"); load(); }
                catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
              }}
            />
          ))}
          {showNew && (
            <NewPersonaModal
              onClose={() => setShowNew(false)}
              onCreate={async (input: any) => {
                try {
                  await createFn({ data: input });
                  toast.success("تم الإنشاء");
                  setShowNew(false);
                  load();
                } catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
              }}
            />
          )}
        </div>
      ) : tab === "templates" ? (
        <TemplatesPanel
          templates={templates}
          onAdd={async (data: any) => {
            try { await addTplFn({ data }); toast.success("تمت الإضافة"); load(); }
            catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
          }}
          onDelete={async (id: string) => {
            try { await delTplFn({ data: { id } }); load(); }
            catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
          }}
        />

      ) : (
        <div className="space-y-1">
          {log.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا يوجد نشاط</p>}
          {log.map((l) => (
            <div key={l.id} className="rounded-xl border border-border bg-card p-2 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold">{l.action}</span>
                <span className="text-muted-foreground"> · {l.target_id?.slice(0, 8)}</span>
              </div>
              <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString("ar")}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function PersonaCard({ p, onToggle, onDelete, onSave }: any) {
  const [interval, setInterval] = useState(p.post_interval_minutes);
  const [rate, setRate] = useState(p.reaction_rate);
  const dirty = interval !== p.post_interval_minutes || Number(rate) !== Number(p.reaction_rate);

  return (
    <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-start gap-2">
        {p.avatar_url
          ? <img src={p.avatar_url} className="h-12 w-12 rounded-full object-cover" alt="" />
          : <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center"><Bot className="h-6 w-6 text-muted-foreground" /></div>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="font-bold truncate">{p.display_name}</div>
            <AiBadge />
            {!p.is_active && <span className="text-[10px] rounded-full bg-muted px-1.5 font-bold text-muted-foreground">موقوف</span>}
          </div>
          <div className="text-xs text-muted-foreground truncate">{p.bio || "—"}</div>
          <div className="text-[10px] text-muted-foreground">نوع: {p.persona_type}</div>
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={onToggle} className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
            {p.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4 text-emerald-600" />}
          </button>
          <button onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] font-bold">
          فاصل النشر (دقيقة)
          <input type="number" value={interval} onChange={(e) => setInterval(Number(e.target.value))}
            className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" />
        </label>
        <label className="text-[11px] font-bold">
          معدل التفاعل (0–1)
          <input type="number" step="0.05" min="0" max="1" value={rate} onChange={(e) => setRate(Number(e.target.value))}
            className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" />
        </label>
      </div>
      {dirty && (
        <button onClick={() => onSave({ post_interval_minutes: interval, reaction_rate: rate })}
          className="h-9 w-full rounded-lg bg-primary text-xs font-bold text-primary-foreground">حفظ التغييرات</button>
      )}
    </div>
  );
}

function NewPersonaModal({ onClose, onCreate }: any) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [personaType, setPersonaType] = useState("friendly");
  const [interval, setInterval] = useState(180);
  const [rate, setRate] = useState(0.3);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!username.trim() || !displayName.trim()) return toast.error("الاسم مطلوب");
    setBusy(true);
    await onCreate({
      username: username.trim(),
      displayName: displayName.trim(),
      bio: bio.trim() || undefined,
      avatarUrl: avatarUrl.trim() || undefined,
      personaType: personaType.trim(),
      postIntervalMinutes: interval,
      reactionRate: rate,
    });
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-extrabold">شخصية جديدة</h2>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="اسم المستخدم (فريد)"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="الاسم الظاهر"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="نبذة (Bio)" rows={2}
          className="w-full rounded-lg border border-input bg-background p-2 text-sm" />
        <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="رابط صورة (اختياري)"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
        <input value={personaType} onChange={(e) => setPersonaType(e.target.value)} placeholder="نوع الشخصية (friendly, news, gamer...)"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-bold">
            فاصل النشر (دقيقة)
            <input type="number" value={interval} onChange={(e) => setInterval(Number(e.target.value))}
              className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" />
          </label>
          <label className="text-[11px] font-bold">
            معدل التفاعل (0–1)
            <input type="number" step="0.05" min="0" max="1" value={rate} onChange={(e) => setRate(Number(e.target.value))}
              className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" />
          </label>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg bg-secondary text-sm font-bold">إلغاء</button>
          <button onClick={submit} disabled={busy}
            className="flex-1 h-10 rounded-lg bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50">
            {busy ? "..." : "إنشاء"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplatesPanel({ templates, onAdd, onDelete }: any) {
  const [personaType, setPersonaType] = useState("friendly");
  const [kind, setKind] = useState<"post" | "story" | "comment" | "reply">("post");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [weight, setWeight] = useState(1);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
        <h3 className="text-sm font-extrabold">إضافة قالب</h3>
        <div className="grid grid-cols-2 gap-2">
          <input value={personaType} onChange={(e) => setPersonaType(e.target.value)} placeholder="نوع الشخصية"
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm" />
          <select value={kind} onChange={(e) => setKind(e.target.value as any)}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
            <option value="post">منشور</option>
            <option value="story">قصة</option>
            <option value="comment">تعليق</option>
            <option value="reply">رد</option>
          </select>
        </div>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="نص المحتوى" rows={2}
          className="w-full rounded-lg border border-input bg-background p-2 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="رابط وسائط (اختياري)"
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm" />
          <input type="number" min={1} value={weight} onChange={(e) => setWeight(Number(e.target.value))}
            placeholder="الوزن" className="h-9 rounded-lg border border-input bg-background px-2 text-sm" />
        </div>
        <button onClick={() => {
          if (!content.trim()) return toast.error("النص مطلوب");
          onAdd({ persona_type: personaType, kind, content: content.trim(), media_url: mediaUrl || null, weight });
          setContent(""); setMediaUrl("");
        }}
          className="h-9 w-full rounded-lg bg-primary text-xs font-bold text-primary-foreground">إضافة</button>
      </div>
      <div className="space-y-1">
        {templates.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">لا توجد قوالب</p>}
        {templates.map((t: any) => (
          <div key={t.id} className="flex items-start justify-between gap-2 rounded-xl border border-border bg-card p-2">
            <div className="min-w-0 text-xs">
              <div className="font-bold">{t.persona_type} · {t.kind} · w{t.weight}</div>
              <div className="text-muted-foreground line-clamp-2">{t.content}</div>
              {t.media_url && <div className="text-[10px] text-muted-foreground">📎 {t.media_url}</div>}
            </div>
            <button onClick={() => onDelete(t.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
