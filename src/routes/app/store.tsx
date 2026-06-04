import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ChevronLeft, Loader2, Coins, Crown, Gem, CheckCircle2, Flame, Star, Sparkles, MessageCircle, Check } from "lucide-react";
import { clearEquippedCache } from "@/lib/equipped";

type ShopItem = {
  id: string;
  kind: "badge" | "name_color" | "chat_color" | "effect";
  code: string;
  name_ar: string;
  price: number;
  payload: Record<string, string>;
  sort_order: number;
};

export const Route = createFileRoute("/app/store")({ component: StorePage });

const TABS: { key: ShopItem["kind"]; label: string }[] = [
  { key: "badge", label: "الشارات" },
  { key: "name_color", label: "ألوان الاسم" },
  { key: "chat_color", label: "ألوان الخط" },
  { key: "effect", label: "مؤثرات الدخول" },
];

function StorePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ShopItem["kind"]>("badge");
  const [items, setItems] = useState<ShopItem[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [equipped, setEquipped] = useState<Record<string, string | null>>({});
  const [points, setPoints] = useState(0);
  const [adminUsername, setAdminUsername] = useState("admin");
  const [adminId, setAdminId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: shop }, { data: prof }, { data: inv }, { data: cfg }] = await Promise.all([
        supabase.from("shop_items").select("*").order("sort_order"),
        supabase.from("profiles").select("points, equipped_badge, equipped_name_color, equipped_chat_color, equipped_effect").eq("id", user.id).maybeSingle(),
        supabase.from("user_inventory").select("item_id").eq("user_id", user.id),
        supabase.from("app_config").select("value").eq("key", "points_seller_username").maybeSingle(),
      ]);
      setItems((shop ?? []) as ShopItem[]);
      setPoints(prof?.points ?? 0);
      setEquipped({
        badge: prof?.equipped_badge ?? null,
        name_color: prof?.equipped_name_color ?? null,
        chat_color: prof?.equipped_chat_color ?? null,
        effect: prof?.equipped_effect ?? null,
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
    setBusyId(null);
    if (error) {
      const m = error.message.includes("insufficient") ? "نقاطك غير كافية"
        : error.message.includes("already_owned") ? "تمتلكه بالفعل" : "تعذّر الشراء";
      toast.error(m); return;
    }
    setPoints((p) => p - item.price);
    setOwned((s) => new Set(s).add(item.id));
    toast.success(`تم شراء «${item.name_ar}» 🎉`);
  };

  const equip = async (item: ShopItem) => {
    if (!user) return;
    setBusyId(item.id);
    const isEquipped = equipped[item.kind] === item.id;
    const { error } = isEquipped
      ? await supabase.rpc("shop_unequip", { _kind: item.kind })
      : await supabase.rpc("shop_equip", { _item: item.id });
    setBusyId(null);
    if (error) { toast.error("تعذّر التطبيق"); return; }
    setEquipped((e) => ({ ...e, [item.kind]: isEquipped ? null : item.id }));
    clearEquippedCache(user.id);
    toast.success(isEquipped ? "تم الإلغاء" : "تم التطبيق");
  };

  const filtered = items.filter((i) => i.kind === tab);

  return (
    <main className="flex flex-1 flex-col pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate({ to: "/app/settings" })} className="flex h-10 w-10 items-center justify-center rounded-full bg-card">
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold">المتجر</h1>
          <p className="text-[11px] text-muted-foreground">اشتر بشاراتك بالنقاط</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-3 py-1.5 text-sm font-extrabold text-black shadow">
          <Coins className="h-4 w-4" /> {points}
        </div>
      </header>

      {/* Admin sales banner */}
      <div className="px-4 pt-4">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-secondary p-4 shadow-lg shadow-primary/10">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-extrabold">شراء النقاط</h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            هذا الحساب يبيع النقاط. راسله مباشرة لشراء النقاط الخاصة بك ثم استخدمها هنا للشراء.
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
        <div className="flex gap-1.5 overflow-x-auto rounded-full bg-secondary p-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${tab === t.key ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 pt-3">
          {filtered.map((item) => {
            const isOwned = owned.has(item.id);
            const isEquipped = equipped[item.kind] === item.id;
            return (
              <div key={item.id} className="flex flex-col items-center rounded-2xl border border-border bg-card p-4 text-center shadow-sm">
                <Preview item={item} />
                <div className="mt-3 text-sm font-bold">{item.name_ar}</div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-500">
                  <Coins className="h-3 w-3" /> {item.price}
                </div>
                {isOwned ? (
                  <button onClick={() => equip(item)} disabled={busyId === item.id}
                    className={`mt-3 flex h-9 w-full items-center justify-center gap-1 rounded-xl text-xs font-bold transition ${isEquipped ? "bg-green-600 text-white" : "border border-primary text-primary"}`}>
                    {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isEquipped ? (<><Check className="h-3.5 w-3.5" /> مُطبَّق</>) : "تطبيق"}
                  </button>
                ) : (
                  <button onClick={() => buy(item)} disabled={busyId === item.id || points < item.price}
                    className="mt-3 h-9 w-full rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow disabled:opacity-50">
                    {busyId === item.id ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : points < item.price ? "نقاط غير كافية" : "شراء"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Preview({ item }: { item: ShopItem }) {
  const color = item.payload.color;
  if (item.kind === "badge") return <BadgeChip code={item.code} color={color} name={item.name_ar} />;
  if (item.kind === "name_color")
    return <div className="text-2xl font-extrabold" style={{ color }}>اسمك</div>;
  if (item.kind === "chat_color")
    return <div className="rounded-2xl bg-primary/15 px-3 py-2 text-sm font-bold" style={{ color }}>مرحباً 👋</div>;
  if (item.kind === "effect") return <div className="text-4xl">{item.payload.emoji}</div>;
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
