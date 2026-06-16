import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Coins, Crown, Gem, CheckCircle2, Flame, Star, Sparkles, MessageCircle, Check, Gift, Lock } from "lucide-react";
import { clearEquippedCache } from "@/lib/equipped";

type ShopItem = {
  id: string;
  kind: "badge" | "name_color" | "chat_color" | "effect" | "avatar_frame";
  code: string;
  name_ar: string;
  price: number;
  payload: Record<string, any>;
  sort_order: number;
  gender_target?: string | null;
};


type GiftItem = {
  id: string;
  name: string;
  emoji: string | null;
  cost_points: number;
  scope: "room" | "global";
  category: string | null;
};

type TabKey = "badge" | "avatar_frame" | "name_color" | "chat_color" | "entry_effect" | "chat_effect" | "gifts";

export const Route = createFileRoute("/app/store")({ component: StorePage });

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "badge", label: "الشارات", icon: Crown },
  { key: "avatar_frame", label: "إطارات البروفايل", icon: Gem },
  { key: "entry_effect", label: "مؤثرات الدخول", icon: Sparkles },
  { key: "chat_effect", label: "مؤثرات الدردشة", icon: Flame },
  { key: "name_color", label: "ألوان الاسم", icon: Star },
  { key: "chat_color", label: "ألوان الخط", icon: Star },
  { key: "gifts", label: "الهدايا", icon: Gift },
];


function StorePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("badge");
  const [items, setItems] = useState<ShopItem[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [equipped, setEquipped] = useState<Record<string, string | null>>({});
  const [points, setPoints] = useState(0);
  const [myGender, setMyGender] = useState<string | null>(null);
  const [adminUsername, setAdminUsername] = useState("admin");
  const [adminId, setAdminId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: shop }, { data: prof }, { data: inv }, { data: cfg }, { data: giftRows }] = await Promise.all([
        supabase.from("shop_items").select("*").order("sort_order"),
        supabase.from("profiles").select("points, gender, equipped_badge, equipped_name_color, equipped_chat_color, equipped_effect, equipped_frame").eq("id", user.id).maybeSingle(),
        supabase.from("user_inventory").select("item_id").eq("user_id", user.id),
        supabase.from("app_config").select("value").eq("key", "points_seller_username").maybeSingle(),
        supabase.from("gifts_catalog").select("id, name, emoji, cost_points, scope, category").eq("is_active", true).order("sort_order"),
      ]);
      setItems((shop ?? []) as ShopItem[]);
      setGifts((giftRows ?? []) as GiftItem[]);
      setPoints((prof as any)?.points ?? 0);
      setMyGender((prof as any)?.gender ?? null);
      setEquipped({
        badge: (prof as any)?.equipped_badge ?? null,
        name_color: (prof as any)?.equipped_name_color ?? null,
        chat_color: (prof as any)?.equipped_chat_color ?? null,
        effect: (prof as any)?.equipped_effect ?? null,
        avatar_frame: (prof as any)?.equipped_frame ?? null,
      });

      setOwned(new Set((inv ?? []).map((r: { item_id: string }) => r.item_id)));
      if (cfg?.value) {
        setAdminUsername(cfg.value);
        const { data: a } = await supabase.from("profiles").select("id").eq("username", cfg.value).maybeSingle();
        if (a) setAdminId(a.id);
      }
      setLoading(false);
    })();
  }, [user]);

  const buy = async (item: ShopItem) => {
    if (!user) return;
    if (points < item.price) { toast.error("نقاطك غير كافية"); return; }
    setBusyId(item.id);
    const { error } = await supabase.rpc("shop_purchase", { _item: item.id });
    if (error) {
      setBusyId(null);
      const m = error.message.includes("insufficient") ? "نقاطك غير كافية"
        : error.message.includes("already_owned") ? "تمتلكه بالفعل" : "تعذّر الشراء";
      toast.error(m); return;
    }
    setPoints((p) => p - item.price);
    setOwned((s) => new Set(s).add(item.id));
    const { error: eqErr } = await supabase.rpc("shop_equip", { _item: item.id });
    setBusyId(null);
    if (!eqErr) {
      setEquipped((e) => ({ ...e, [item.kind]: item.id }));
      clearEquippedCache(user.id);
      toast.success(`تم شراء «${item.name_ar}» وتفعيله 🎉`);
    } else {
      toast.success(`تم شراء «${item.name_ar}» 🎉`);
    }
  };

  const equip = async (item: ShopItem) => {
    if (!user) return;
    setBusyId(item.id);
    const isEquipped = equipped[item.kind] === item.id;
    const { error } = isEquipped
      ? await supabase.rpc("shop_unequip", { _kind: item.kind })
      : await supabase.rpc("shop_equip", { _item: item.id });
    setBusyId(null);
    if (error) {
      const m = error.message.includes("gender_restricted") ? "هذا المؤثر مخصص لجنس آخر" : "تعذّر التطبيق";
      toast.error(m); return;
    }
    setEquipped((e) => ({ ...e, [item.kind]: isEquipped ? null : item.id }));
    clearEquippedCache(user.id);
    toast.success(isEquipped ? "تم الإلغاء" : "تم التطبيق");
  };

  const filtered = useMemo(() => {
    if (tab === "entry_effect") return items.filter((i) => i.kind === "effect" && i.code.startsWith("entry_"));
    if (tab === "chat_effect") return items.filter((i) => i.kind === "effect" && !i.code.startsWith("entry_"));
    if (tab === "gifts") return [];
    if (tab === "avatar_frame") return items.filter((i) => i.kind === "avatar_frame");
    return items.filter((i) => i.kind === tab);
  }, [items, tab]);


  return (
    <main className="flex flex-1 flex-col pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate({ to: "/app/settings" })} className="flex h-10 w-10 items-center justify-center rounded-full bg-card">
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold">المتجر</h1>
          <p className="text-[11px] text-muted-foreground">كل المؤثرات والشارات والهدايا في مكان واحد</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-3 py-1.5 text-sm font-extrabold text-black shadow">
          <Coins className="h-4 w-4" /> {points.toLocaleString()}
        </div>
      </header>

      <div className="px-4 pt-4">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-secondary p-4 shadow-lg shadow-primary/10">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-extrabold">شراء النقاط</h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            راسل بائع النقاط الرسمي ثم استخدم نقاطك هنا لشراء الشارات، المؤثرات، أو إرسال الهدايا.
          </p>
          <div className="flex items-center justify-between rounded-xl bg-background/60 p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">@{adminUsername}</div>
              <div className="text-[10px] text-muted-foreground">بائع النقاط الرسمي</div>
            </div>
            {adminId ? (
              <Link to="/app/chats/$id" params={{ id: adminId }}
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow">
                <MessageCircle className="h-4 w-4" /> مراسلة
              </Link>
            ) : (
              <span className="rounded-full bg-muted px-3 py-2 text-xs text-muted-foreground">قريباً</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-[68px] z-10 mt-4 bg-background/90 px-4 pb-2 pt-1 backdrop-blur">
        <div className="flex gap-1.5 overflow-x-auto rounded-2xl bg-secondary p-1 scrollbar-thin">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition ${tab === t.key ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"}`}>
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : tab === "gifts" ? (
        <GiftsCatalog gifts={gifts} />
      ) : (
        <>
          {tab === "entry_effect" && (
            <p className="px-4 pt-3 text-[11px] text-muted-foreground">
              مؤثرات تُعرض تلقائياً عند دخولك أي غرفة وعند فتح بروفايلك. بعضها مخصص للذكور وبعضها للإناث.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 px-4 pt-3">
            {filtered.map((item) => {
              const isOwned = owned.has(item.id);
              const isEquipped = equipped[item.kind] === item.id;
              const genderLocked = !!item.gender_target && myGender !== item.gender_target;
              return (
                <div key={item.id} className="relative flex flex-col items-center rounded-2xl border border-border bg-card p-4 text-center shadow-sm">
                  {item.gender_target && (
                    <span className={`absolute top-2 start-2 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${item.gender_target === "female" ? "bg-pink-500/20 text-pink-600" : "bg-blue-500/20 text-blue-600"}`}>
                      {item.gender_target === "female" ? "👩 إناث" : "👨 ذكور"}
                    </span>
                  )}
                  <Preview item={item} />
                  <div className="mt-3 text-sm font-bold">{item.name_ar}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-500">
                    <Coins className="h-3 w-3" /> {item.price.toLocaleString()}
                  </div>
                  {isOwned ? (
                    <button onClick={() => equip(item)} disabled={busyId === item.id || genderLocked}
                      className={`mt-3 flex h-9 w-full items-center justify-center gap-1 rounded-xl text-xs font-bold transition disabled:opacity-50 ${isEquipped ? "bg-green-600 text-white" : "border border-primary text-primary"}`}>
                      {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" />
                        : genderLocked ? (<><Lock className="h-3 w-3" /> غير متاح</>)
                        : isEquipped ? (<><Check className="h-3.5 w-3.5" /> مُطبَّق</>) : "تطبيق"}
                    </button>
                  ) : (
                    <button onClick={() => buy(item)} disabled={busyId === item.id || points < item.price || genderLocked}
                      className="mt-3 h-9 w-full rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow disabled:opacity-50">
                      {busyId === item.id ? <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                        : genderLocked ? "غير متاح"
                        : points < item.price ? "نقاط غير كافية" : "شراء"}
                    </button>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">لا توجد عناصر في هذا القسم بعد</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}

function GiftsCatalog({ gifts }: { gifts: GiftItem[] }) {
  return (
    <div className="px-4 pt-3">
      <div className="mb-3 rounded-xl border border-pink-400/30 bg-gradient-to-br from-pink-50 to-fuchsia-50 dark:from-pink-950/30 dark:to-fuchsia-950/30 p-3 text-[11px] text-muted-foreground">
        🎁 الهدايا تُرسل لأعضاء آخرين من داخل الغرف. افتح أي غرفة واضغط زر «هدية» لتختار العضو والهدية.
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {gifts.map((g) => (
          <div key={g.id} className="relative flex flex-col items-center rounded-2xl border border-border bg-card p-3 text-center">
            {g.scope === "global" && (
              <span className="absolute top-1 start-1 text-[8px] px-1 py-0.5 rounded bg-amber-500 text-white font-bold">عالمي 🌍</span>
            )}
            <div className="text-4xl">{g.emoji ?? "🎁"}</div>
            <div className="mt-1 text-[11px] font-bold truncate w-full">{g.name}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-600">
              <Coins className="h-2.5 w-2.5" /> {g.cost_points.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Preview({ item }: { item: ShopItem }) {
  const color = item.payload?.color;
  if (item.kind === "badge") return <BadgeChip code={item.code} color={color} name={item.name_ar} />;
  if (item.kind === "name_color")
    return <div className="text-2xl font-extrabold" style={{ color }}>اسمك</div>;
  if (item.kind === "chat_color")
    return <div className="rounded-2xl bg-primary/15 px-3 py-2 text-sm font-bold" style={{ color }}>مرحباً 👋</div>;
  if (item.kind === "effect") {
    if (item.code.startsWith("entry_")) {
      const map: Record<string, string> = {
        entry_dragon: "🐉", entry_princess: "👸", entry_knight: "🛡️",
        entry_magic: "✨", entry_mascot: "🎉", entry_portal: "🌀",
      };
      return <div className="text-5xl">{map[item.code] ?? "✨"}</div>;
    }
    return <div className="text-4xl">{item.payload?.emoji ?? "✨"}</div>;
  }
  return null;
}

export function BadgeChip({ code, color, name }: { code: string; color?: string; name: string }) {
  const Icon = code.includes("diamond") ? Gem : code.includes("verified") ? CheckCircle2 : code.includes("fire") ? Flame : code.includes("star") ? Star : Crown;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold text-white shadow-sm"
      style={{ backgroundColor: color ?? "#EF4444" }}
      title={name}
    >
      <Icon className="h-3 w-3" /> {name}
    </span>
  );
}
