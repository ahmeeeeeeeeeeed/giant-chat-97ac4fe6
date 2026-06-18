import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/lib/theme";
import { signOut, useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/use-admin";
import {
  Moon, Sun, LogOut, ChevronLeft, Globe, Check,
  ShoppingBag, Flag,
  Trophy, Shield, Info, HelpCircle,
  Star, Share2, Crown,
  X, Copy, Loader2, Sparkles, Download, MessageCircle, Send, Mail,
  Trash2, FileText, ScrollText, Wifi, WifiOff,
} from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { findAdminId } from "@/lib/find-admin";
import { APP_VERSION, getVersionCode } from "@/lib/version";
import { isNativeAndroid, downloadAndInstallApk, applyWebBundleUpdate, shouldShowUpdate, shouldInstallFullApk, getDisplayInstalledVersion, getDisplayInstalledCode, notifyNativeUpdateReady, syncNativeInstalledVersion, getRememberedDownloadedApk, openDownloadedApk } from "@/lib/app-update";
import { cacheGet, cacheSet, cacheDel } from "@/lib/offline-cache";
import { getOnline, useOnline } from "@/lib/use-online";
import { toast } from "sonner";
import { PremiumCreateModal } from "@/components/PremiumCreateModal";

export const Route = createFileRoute("/app/settings")({
  validateSearch: (s: Record<string, unknown>) => ({ about: s.about ? 1 : undefined }),
  component: SettingsPage,
});

const SHARE_URL = "https://giant-chat.lovable.app";
const SHARE_TEXT = "حمّل تطبيق Giant Chat — دردشة، غرف صوتية، وأصدقاء جدد في مكان واحد 💬✨";

type LatestUpdate = {
  version: string;
  version_code: number;
  update_message: string;
  file_url: string;
  web_bundle_url: string | null;
  web_bundle_version: string | null;
} | null;


function SettingsPage() {
  const { theme, toggle } = useTheme();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [showLang, setShowLang] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showClearCache, setShowClearCache] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [username, setUsername] = useState("");
  const [latest, setLatest] = useState<LatestUpdate>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [downloadedApkPath, setDownloadedApkPath] = useState<string | null>(null);
  const online = useOnline();

  const doLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate({ to: "/" });
    } finally {
      setSigningOut(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    // Load cached username instantly (offline-first)
    void cacheGet<string>(`settings:username:${user.id}`).then((cached) => {
      if (cached) setUsername(cached);
    });
    if (!getOnline()) return;
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.username) {
        setUsername(data.username);
        void cacheSet(`settings:username:${user.id}`, data.username);
      }
    });
  }, [user?.id]);

  // Load cached "latest update" info so the About modal works offline.
  useEffect(() => {
    void cacheGet<LatestUpdate>("settings:latestUpdate").then((cached) => {
      if (cached) setLatest(cached);
    });
  }, []);

  // Auto-open About modal when arriving via ?about=1 (e.g. from profile/account "حول التطبيق").
  const search = Route.useSearch();
  useEffect(() => {
    if (search.about) {
      setShowAbout(true);
      if (getOnline()) void checkForUpdate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.about]);

  const openReports = async () => {
    if (!getOnline()) { toast.error("لا يوجد اتصال بالإنترنت"); return; }
    const id = await findAdminId();
    if (!id) { toast.error("لم يتم العثور على حساب الإدارة"); return; }
    navigate({ to: "/app/chats/$id", params: { id } });
  };

  const checkForUpdate = async () => {
    if (!getOnline()) {
      toast.error("لا يوجد اتصال — يتم عرض آخر معلومات محفوظة");
      return;
    }
    setCheckingUpdate(true);
    try {
      await notifyNativeUpdateReady();
      await syncNativeInstalledVersion();
      const { data } = await supabase
        .from("app_updates")
        .select("version, version_code, update_message, file_url, web_bundle_url, web_bundle_version")
        .eq("is_active", true)
        .order("version_code", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data && shouldShowUpdate(data)) {
        const update = data as NonNullable<LatestUpdate>;
        setLatest(update);
        setDownloadedApkPath(update.file_url ? getRememberedDownloadedApk(update.file_url) : null);
        void cacheSet("settings:latestUpdate", data);
      } else {
        setLatest(null);
        setDownloadedApkPath(null);
        void cacheDel("settings:latestUpdate");
      }
    } catch { /* offline */ }
    finally { setCheckingUpdate(false); }
  };


  const openAbout = () => { setShowAbout(true); if (getOnline()) void checkForUpdate(); };

  const installUpdate = async () => {
    if (!latest) return;
    setInstalling(true);
    setInstallProgress(0);
    try {
      const needsFullApk = shouldInstallFullApk(latest);
      if (needsFullApk) {
        if (!(await isNativeAndroid())) {
          window.open(latest.file_url, "_blank");
          return;
        }
        if (downloadedApkPath) {
          await openDownloadedApk(downloadedApkPath);
          toast.success("تم فتح نافذة التثبيت");
          return;
        }
        const result = await downloadAndInstallApk(
          latest.file_url,
          (p) => setInstallProgress(p),
        );
        setDownloadedApkPath(result.filePath);
        return;
      }
      // Prefer OTA web bundle update — no full reinstall, just refresh the changed pieces.
      if (latest.web_bundle_url) {
        const v = latest.web_bundle_version || latest.version;
        await applyWebBundleUpdate(latest.web_bundle_url, v, (p) => setInstallProgress(p));
        toast.success("تم تطبيق التحديث");
        return;
      }
      // Fallback: full APK only when no OTA bundle is published.
      if (!(await isNativeAndroid())) {
        window.open(latest.file_url, "_blank");
        return;
      }
      await downloadAndInstallApk(
        latest.file_url,
        (p) => setInstallProgress(p),
      );
    } catch (e: any) {
      if (String(e?.message || "").includes("ملف التحديث غير موجود")) setDownloadedApkPath(null);
      toast.error(e?.message || "فشل التحديث");
    } finally {
      setInstalling(false);
    }
  };


  const openShare = async () => {
    const payload = { title: "Giant Chat", text: SHARE_TEXT, url: SHARE_URL };
    try {
      if (await isNativeAndroid()) {
        const { Share } = await import("@capacitor/share");
        await Share.share({ ...payload, dialogTitle: "مشاركة Giant Chat" });
        return;
      }
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share(payload);
        return;
      }
    } catch (e: any) {
      if (e?.message && /cancel|abort|dismiss/i.test(String(e.message))) return;
    }
    setShowShare(true);
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT}\n${SHARE_URL}`);
      toast.success("تم نسخ الرابط");
    } catch { toast.error("تعذر النسخ"); }
  };

  const clearCache = async () => {
    setClearingCache(true);
    try {
      // Clear caches API
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      // Clear IndexedDB (giant-offline + idb-keyval default + others)
      if (typeof indexedDB !== "undefined") {
        try {
          const dbs = await (indexedDB as any).databases?.();
          if (Array.isArray(dbs)) {
            await Promise.all(
              dbs.map((d: any) => d?.name ? new Promise<void>((res) => {
                const req = indexedDB.deleteDatabase(d.name);
                req.onsuccess = req.onerror = req.onblocked = () => res();
              }) : Promise.resolve())
            );
          } else {
            ["giant-offline", "keyval-store"].forEach((n) => indexedDB.deleteDatabase(n));
          }
        } catch { /* ignore */ }
      }
      // Clear native filesystem mirror
      try {
        const [{ Capacitor }, fs] = await Promise.all([
          import("@capacitor/core"),
          import("@capacitor/filesystem"),
        ]);
        if (Capacitor.isNativePlatform()) {
          try {
            await fs.Filesystem.rmdir({ path: "offline-cache", directory: fs.Directory.Data, recursive: true });
          } catch { /* ignore */ }
        }
      } catch { /* not native */ }
      try { localStorage.clear(); } catch { /* ignore */ }
      try { sessionStorage.clear(); } catch { /* ignore */ }
      toast.success("تم مسح التخزين المؤقت");
      setShowClearCache(false);
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) {
      toast.error(e?.message || "فشل المسح");
    } finally {
      setClearingCache(false);
    }
  };

  const hasUpdate = latest && shouldShowUpdate(latest);
  const latestNeedsFullApk = latest ? shouldInstallFullApk(latest) : false;
  const apkReadyToInstall = latestNeedsFullApk && Boolean(downloadedApkPath);
  const displayVersion = getDisplayInstalledVersion();
  const displayCode = getDisplayInstalledCode();

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0];

  return (
    <main className="flex flex-1 flex-col bg-gradient-to-b from-background to-secondary/30 pb-8">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <h1 className="text-2xl font-extrabold">{t("settings.title")}</h1>
        {username && <p className="mt-0.5 text-[12px] text-muted-foreground truncate">@{username}</p>}
      </header>

      <div className="flex flex-col gap-4 px-4 py-5">
        {/* Featured */}
        <div className="grid grid-cols-2 gap-3">
          <FeatureTile to="/app/store" icon={ShoppingBag} title="المتجر" subtitle="شارات • مؤثرات"
            gradient="from-violet-500 via-fuchsia-500 to-pink-500" />
          <FeatureTile to="/app/achievements" icon={Trophy} title="الإنجازات" subtitle="ترتيب أسبوعي"
            gradient="from-amber-400 via-orange-500 to-rose-500" />
        </div>

        {/* Account */}
        <Section title="الحساب">
          <button onClick={() => setShowPremium(true)} className="flex w-full items-center justify-between p-4 active:bg-secondary/60 text-start">
            <div className="flex items-center gap-3">
              <IconBox color="bg-amber-500"><Crown className="h-4 w-4" /></IconBox>
              <div className="flex flex-col items-start">
                <span className="font-medium">إنشاء حساب مميز</span>
                <span className="text-[11px] text-muted-foreground">50,000 نقطة • اسم عربي أو مزخرف</span>
              </div>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </button>
        </Section>

        {/* Preferences */}
        <Section title="التفضيلات">
          <button onClick={toggle} className="flex w-full items-center justify-between p-4 active:bg-secondary/60">
            <div className="flex items-center gap-3">
              <IconBox color={theme === "dark" ? "bg-indigo-500" : "bg-amber-500"}>
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </IconBox>
              <span className="font-medium">{theme === "dark" ? t("settings.dark") : t("settings.light")}</span>
            </div>
            <span className="text-[11px] text-muted-foreground">اضغط للتبديل</span>
          </button>
          <button onClick={() => setShowLang(true)} className="flex w-full items-center justify-between p-4 active:bg-secondary/60">
            <div className="flex items-center gap-3">
              <IconBox color="bg-emerald-500"><Globe className="h-4 w-4" /></IconBox>
              <span className="font-medium">{t("settings.language")}</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              {currentLang.name}
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            </div>
          </button>
          <div className="flex w-full items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <IconBox color={online ? "bg-emerald-500" : "bg-zinc-500"}>
                {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              </IconBox>
              <div className="flex flex-col items-start">
                <span className="font-medium">حالة الاتصال</span>
                <span className="text-[11px] text-muted-foreground">{online ? "متصل بالإنترنت" : "وضع عدم الاتصال"}</span>
              </div>
            </div>
            <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-zinc-400"}`} />
          </div>
        </Section>

        {/* Storage */}
        <Section title="التخزين والأداء">
          <button onClick={() => setShowClearCache(true)} className="flex w-full items-center justify-between p-4 active:bg-secondary/60 text-start">
            <div className="flex items-center gap-3">
              <IconBox color="bg-rose-500"><Trash2 className="h-4 w-4" /></IconBox>
              <div className="flex flex-col items-start">
                <span className="font-medium">مسح التخزين المؤقت</span>
                <span className="text-[11px] text-muted-foreground">لتسريع التطبيق وتفريغ المساحة</span>
              </div>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </button>
        </Section>

        {/* Support */}
        <Section title="الدعم والمساعدة">
          <button onClick={openReports} className="flex w-full items-center justify-between p-4 active:bg-secondary/60 text-start">
            <div className="flex items-center gap-3">
              <IconBox color="bg-orange-500"><Flag className="h-4 w-4" /></IconBox>
              <div className="flex flex-col items-start">
                <span className="font-medium">الإبلاغ والشكاوى</span>
                <span className="text-[11px] text-muted-foreground">تواصل مع الإدارة للإبلاغ عن مشكلة أو إساءة</span>
              </div>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </button>
          <button onClick={openShare} className="flex w-full items-center justify-between p-4 active:bg-secondary/60 text-start">
            <div className="flex items-center gap-3">
              <IconBox color="bg-sky-500"><Share2 className="h-4 w-4" /></IconBox>
              <div className="flex flex-col items-start">
                <span className="font-medium">شارك التطبيق</span>
                <span className="text-[11px] text-muted-foreground">انشر رابط التطبيق مع أصدقائك على أي منصة</span>
              </div>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </button>
          <button
            onClick={() => {
              const url = "https://giant-chat.lovable.app/reviews";
              try {
                window.open(url, "_blank", "noopener,noreferrer");
              } catch {
                window.location.href = url;
              }
            }}
            className="flex w-full items-center justify-between p-4 active:bg-secondary/60 text-start"
          >
            <div className="flex items-center gap-3">
              <IconBox color="bg-yellow-500"><Star className="h-4 w-4" /></IconBox>
              <div className="flex flex-col items-start">
                <span className="font-medium">قيّم التطبيق</span>
                <span className="text-[11px] text-muted-foreground">شاركنا رأيك واطّلع على آراء المستخدمين</span>
              </div>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </button>
          <button onClick={() => setShowHelp(true)} className="flex w-full items-center justify-between p-4 active:bg-secondary/60 text-start">
            <div className="flex items-center gap-3">
              <IconBox color="bg-teal-500"><HelpCircle className="h-4 w-4" /></IconBox>
              <div className="flex flex-col items-start">
                <span className="font-medium">المساعدة والأسئلة الشائعة</span>
                <span className="text-[11px] text-muted-foreground">إجابات لأشهر الأسئلة وشرح كامل لميزات التطبيق</span>
              </div>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </button>
        </Section>

        {/* Legal */}
        <Section title="الخصوصية والقانونية">
          <Link to="/privacy" className="flex w-full items-center justify-between p-4 active:bg-secondary/60 text-start">
            <div className="flex items-center gap-3">
              <IconBox color="bg-indigo-500"><FileText className="h-4 w-4" /></IconBox>
              <span className="font-medium">سياسة الخصوصية</span>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </Link>
          <button onClick={() => setShowTerms(true)} className="flex w-full items-center justify-between p-4 active:bg-secondary/60 text-start">
            <div className="flex items-center gap-3">
              <IconBox color="bg-purple-500"><ScrollText className="h-4 w-4" /></IconBox>
              <span className="font-medium">شروط الاستخدام</span>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          </button>
          <button onClick={openAbout} className="flex w-full items-center justify-between p-4 active:bg-secondary/60 text-start">
            <div className="flex items-center gap-3">
              <IconBox color="bg-slate-500"><Info className="h-4 w-4" /></IconBox>
              <span className="font-medium">عن التطبيق</span>
            </div>
            <span className="text-[11px] text-muted-foreground">v{displayVersion || APP_VERSION}</span>
          </button>
        </Section>


        {isAdmin && (
          <Section title="الإدارة">
            <Row to="/app/admin" icon={Shield} label="لوحة التحكم" />
          </Section>
        )}

        <button
          onClick={() => setShowLogout(true)}
          className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 py-3.5 font-semibold text-destructive active:scale-[0.99] transition"
        >
          <LogOut className="h-4 w-4" />
          {t("auth.logout")}
        </button>
      </div>

      {/* App version */}
      <div className="pt-2 pb-6 text-center text-xs text-muted-foreground">
        Giant • v{displayVersion || APP_VERSION}
      </div>



      {/* Logout confirm */}
      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5" onClick={() => !signingOut && setShowLogout(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl">
            <h2 className="mb-1 text-lg font-bold">تأكيد تسجيل الخروج</h2>
            <p className="mb-4 text-sm text-muted-foreground">هل تريد تسجيل الخروج من حسابك؟</p>
            <div className="flex gap-2">
              <button disabled={signingOut} onClick={() => setShowLogout(false)}
                className="h-11 flex-1 rounded-xl border border-input font-semibold">إلغاء</button>
              <button disabled={signingOut} onClick={doLogout}
                className="h-11 flex-1 rounded-xl bg-destructive text-destructive-foreground font-semibold disabled:opacity-60">
                {signingOut ? "..." : "تأكيد"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Language picker */}
      {showLang && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setShowLang(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 pb-8">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <h2 className="mb-3 text-lg font-bold">{t("settings.language")}</h2>
            <ul className="flex flex-col">
              {SUPPORTED_LANGUAGES.map((l) => {
                const active = i18n.language === l.code;
                return (
                  <li key={l.code}>
                    <button
                      onClick={() => { i18n.changeLanguage(l.code); setShowLang(false); }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-start hover:bg-secondary"
                      dir={l.dir}
                    >
                      <span className="font-medium">{l.name}</span>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <PremiumCreateModal open={showPremium} onClose={() => setShowPremium(false)} mode="points" />

      {/* Help & FAQ */}
      {showHelp && (
        <Modal title="المساعدة والأسئلة الشائعة" onClose={() => setShowHelp(false)} icon={<HelpCircle className="h-5 w-5" />} color="bg-teal-500">
          <div className="space-y-4 text-sm leading-relaxed">
            <Intro>
              مرحبًا بك في مركز المساعدة 👋
              <br />
              هنا تجد إجابات لأكثر الأسئلة شيوعًا. لم تجد ما تبحث عنه؟ تواصل مع الإدارة من خلال زر «الإبلاغ والشكاوى».
            </Intro>
            <Faq q="كيف أنشئ حسابًا أو أسجّل الدخول؟" a="افتح التطبيق ثم اضغط «إنشاء حساب» وأدخل اسم المستخدم وكلمة السر. لاستعادة الحساب استخدم زر «نسيت كلمة السر» في صفحة الدخول." />
            <Faq q="كيف أضيف صديقًا؟" a="اضغط على اسم أي مستخدم لعرض ملفه الشخصي ثم زر «إضافة صديق». عندما يقبل الطلب تظهر علامة الصداقة وتتمكن من رؤية حالته (متصل / آخر ظهور)." />
            <Faq q="لماذا لا أرى حالة بعض المستخدمين؟" a="حالة الاتصال وآخر ظهور تظهر فقط للأصدقاء المتبادلين. أمّا غير الأصدقاء فلا تظهر لهم حالتك، وكذلك أنت لا ترى حالتهم — حمايةً لخصوصية الجميع." />
            <Faq q="ماذا تعني علامات الصح في الرسائل؟" a="✓ تم إرسال الرسالة. ✓✓ وصلت إلى الطرف الآخر. ✓✓ زرقاء: تمت قراءة الرسالة (للأصدقاء فقط)." />
            <Faq q="كيف أبدأ مكالمة صوتية أو فيديو؟" a="افتح أي محادثة خاصة ثم اضغط أيقونة الهاتف للمكالمة الصوتية أو أيقونة الكاميرا للفيديو، أعلى شاشة المحادثة. سيرن الطرف الآخر فوراً، وعند الرد يبدأ الاتصال المباشر مع تشفير DTLS-SRTP بدون أي رسوم. تستطيع كتم الميكروفون، تفعيل السماعة، تبديل الكاميرا الأمامية/الخلفية، وإنهاء المكالمة في أي لحظة." />
            <Faq q="هل تعمل الرسائل بدون إنترنت؟" a="نعم. المحادثات الخاصة تُحفظ محليًا على جهازك، فيمكنك تصفّحها أثناء انقطاع الإنترنت، وتُرسَل الرسائل المعلّقة تلقائيًا عند عودة الاتصال." />
            <Faq q="كيف أنشئ غرفة صوتية؟" a="من الصفحة الرئيسية اضغط زر «إنشاء غرفة»، اختر الاسم والصورة ونوع الغرفة (عامة/خاصة) ثم انشرها لتصبح متاحة." />
            <Faq q="كيف أحصل على حساب مميز؟" a="من «الإعدادات» → «إنشاء حساب مميز». تحتاج إلى 50,000 نقطة لتفعيل الاسم العربي أو المزخرف وميزات إضافية." />
            <Faq q="كيف أكسب النقاط والإنجازات؟" a="بالتفاعل اليومي: تسجيل الدخول، إرسال الرسائل، الانضمام للغرف، والمشاركة في المجتمع. راجع صفحة «الإنجازات» للتفاصيل." />
            <Faq q="كيف أبلّغ عن مستخدم أو محتوى مسيء؟" a="من ملف المستخدم أو الرسالة اضغط «إبلاغ»، أو افتح «الإبلاغ والشكاوى» من الإعدادات للتواصل المباشر مع الإدارة." />
            <Faq q="كيف أحذف حسابي؟" a="من «إدارة الحساب وكلمة السر» اضغط «حذف الحساب». الحذف نهائي ولا يمكن التراجع عنه." />
          </div>
        </Modal>
      )}

      {/* About */}
      {showAbout && (
        <Modal title="عن التطبيق" onClose={() => setShowAbout(false)} icon={<Info className="h-5 w-5" />} color="bg-slate-600">
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center py-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-lg">
                <Sparkles className="h-8 w-8" />
              </div>
              <h3 className="mt-3 text-xl font-extrabold">Giant Chat</h3>
              <p className="text-xs text-muted-foreground mt-1">دردشة • غرف صوتية • مجتمع</p>
            </div>

            <div className="rounded-2xl border border-border bg-secondary/30 p-4 space-y-2 text-sm">
              <Row2 label="الإصدار الحالي" value={`v${displayVersion || APP_VERSION}`} />
              <Row2 label="رقم البناء" value={String(displayCode || getVersionCode(APP_VERSION))} />
              <Row2 label="الجهة المطوّرة" value="فريق Giant" />
              <Row2 label="الموقع الرسمي" value="giant-chat.lovable.app" />
            </div>

            {checkingUpdate && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جارٍ التحقق من التحديثات...</span>
              </div>
            )}

            {!checkingUpdate && hasUpdate && latest && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 font-bold">
                  <Download className="h-4 w-4" />
                  تحديث جديد متاح — v{latest.version}
                </div>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                  {latest.web_bundle_url && !latestNeedsFullApk
                    ? "تحديث سريع داخل التطبيق — يطبّق النسخة الجديدة ويعيد تشغيل التطبيق."
                    : "تحديث كامل للتطبيق — يتطلب إعادة تثبيت."}
                </p>
                {latest.update_message && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{latest.update_message}</p>
                )}

                {installing && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${installProgress}%` }} />
                  </div>
                )}
                <button
                  onClick={installUpdate}
                  disabled={installing}
                  className="mt-1 h-11 w-full rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {installing ? <><Loader2 className="h-4 w-4 animate-spin" /> {installProgress}%</> : <><Download className="h-4 w-4" /> {apkReadyToInstall ? "فتح نافذة التثبيت" : "تحديث الآن"}</>}
                </button>
              </div>
            )}

            {!checkingUpdate && !hasUpdate && (
              <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                أنت تستخدم أحدث إصدار
              </div>
            )}

            <button
              onClick={checkForUpdate}
              disabled={checkingUpdate}
              className="h-11 w-full rounded-xl border border-input font-semibold text-sm disabled:opacity-60"
            >
              {checkingUpdate ? "جارٍ التحقق..." : "التحقق من التحديثات"}
            </button>

            <p className="text-center text-[11px] text-muted-foreground">
              © {new Date().getFullYear()} Giant Chat — جميع الحقوق محفوظة
            </p>
          </div>
        </Modal>
      )}

      {/* Share fallback (web without navigator.share) */}
      {showShare && (
        <Modal title="مشاركة التطبيق" onClose={() => setShowShare(false)} icon={<Share2 className="h-5 w-5" />} color="bg-sky-500">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">اختر الوسيلة التي تريد المشاركة من خلالها</p>
            <div className="grid grid-cols-4 gap-3">
              <ShareTarget label="واتساب" color="bg-emerald-500"
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT}\n${SHARE_URL}`)}`, "_blank")}
                icon={<MessageCircle className="h-5 w-5" />} />
              <ShareTarget label="تيليجرام" color="bg-sky-500"
                onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(SHARE_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`, "_blank")}
                icon={<Send className="h-5 w-5" />} />
              <ShareTarget label="فيسبوك" color="bg-blue-600"
                onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`, "_blank")}
                icon={<Share2 className="h-5 w-5" />} />
              <ShareTarget label="X / تويتر" color="bg-slate-900"
                onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SHARE_URL)}`, "_blank")}
                icon={<X className="h-5 w-5" />} />
              <ShareTarget label="بريد" color="bg-rose-500"
                onClick={() => window.open(`mailto:?subject=${encodeURIComponent("Giant Chat")}&body=${encodeURIComponent(`${SHARE_TEXT}\n${SHARE_URL}`)}`)}
                icon={<Mail className="h-5 w-5" />} />
              <ShareTarget label="نسخ الرابط" color="bg-zinc-600"
                onClick={copyShareLink} icon={<Copy className="h-5 w-5" />} />
            </div>
            <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs break-all text-center font-mono">
              {SHARE_URL}
            </div>
          </div>
        </Modal>
      )}

      {/* Privacy Policy */}
      {showPrivacy && (
        <Modal title="سياسة الخصوصية" onClose={() => setShowPrivacy(false)} icon={<FileText className="h-5 w-5" />} color="bg-indigo-500">
          <div className="space-y-4 text-sm leading-relaxed">
            <Intro>
              نحن في Giant Chat نحترم خصوصيتك ونلتزم بحماية بياناتك. توضح هذه السياسة ما نجمعه وكيف نستخدمه.
            </Intro>
            <Section2 title="1) البيانات التي نجمعها">
              • اسم المستخدم والبريد الإلكتروني عند التسجيل.<br />
              • صورة الملف الشخصي والمعلومات التي تشاركها طوعًا.<br />
              • الرسائل والمحادثات (مشفّرة أثناء النقل، مرتبطة بحسابك فقط).<br />
              • معلومات الجهاز الأساسية لتشغيل الإشعارات والتحديثات.
            </Section2>
            <Section2 title="2) كيف نستخدم البيانات">
              • لتقديم خدمات الدردشة والغرف الصوتية والمجتمع.<br />
              • لتحسين الأداء والأمان ومنع الإساءة.<br />
              • للتواصل معك بشأن الإشعارات والتحديثات الهامة.
            </Section2>
            <Section2 title="3) المشاركة مع أطراف ثالثة">
              لا نبيع بياناتك. نشاركها فقط مع مزوّدي البنية التحتية الضرورية لتشغيل التطبيق، وعند الطلب القانوني.
            </Section2>
            <Section2 title="4) حقوقك">
              • يمكنك تعديل ملفك أو حذف حسابك في أي وقت من «إدارة الحساب».<br />
              • يمكنك طلب نسخة من بياناتك أو حذفها نهائيًا.<br />
              • يمكنك حظر أي مستخدم أو الإبلاغ عن المحتوى المسيء.
            </Section2>
            <Section2 title="5) أمان البيانات">
              نستخدم تشفير TLS وسياسات وصول صارمة على مستوى قاعدة البيانات (RLS) لحماية بياناتك.
            </Section2>
            <p className="text-[11px] text-muted-foreground text-center pt-2">
              آخر تحديث: {new Date().toLocaleDateString("ar")}
            </p>
          </div>
        </Modal>
      )}

      {/* Terms of Use */}
      {showTerms && (
        <Modal title="شروط الاستخدام" onClose={() => setShowTerms(false)} icon={<ScrollText className="h-5 w-5" />} color="bg-purple-500">
          <div className="space-y-4 text-sm leading-relaxed">
            <Intro>
              باستخدامك Giant Chat، فإنك توافق على الشروط التالية. يُرجى قراءتها بعناية.
            </Intro>
            <Section2 title="1) الأهلية">
              يجب ألا يقل عمرك عن 13 عامًا لاستخدام التطبيق. أنت مسؤول عن صحة المعلومات التي تقدّمها.
            </Section2>
            <Section2 title="2) السلوك المقبول">
              يُمنع منعًا باتًا: التحرش، نشر الإباحية، خطاب الكراهية، الترويج للعنف، انتحال الشخصية، أو نشر محتوى يخالف القانون. مخالفة ذلك تؤدي إلى تعليق الحساب أو حذفه نهائيًا.
            </Section2>
            <Section2 title="3) المحتوى الذي تنشره">
              تحتفظ بحقوق المحتوى الخاص بك، لكنك تمنحنا الترخيص لعرضه داخل التطبيق لخدمة المستخدمين الآخرين.
            </Section2>
            <Section2 title="4) النقاط والمميزات">
              النقاط والشارات افتراضية، غير قابلة للتحويل لأموال حقيقية، ويحق للإدارة تعديل أو إلغاء أيٍّ منها لأسباب فنية أو أمنية.
            </Section2>
            <Section2 title="5) إنهاء الخدمة">
              يحق للإدارة إنهاء أو تعليق أي حساب يخالف الشروط دون إشعار مسبق.
            </Section2>
            <Section2 title="6) إخلاء المسؤولية">
              يُقدَّم التطبيق «كما هو». لا نضمن خلوه التام من الأخطاء، ولا نتحمل مسؤولية أي خسائر ناتجة عن سوء الاستخدام.
            </Section2>
            <p className="text-[11px] text-muted-foreground text-center pt-2">
              آخر تحديث: {new Date().toLocaleDateString("ar")}
            </p>
          </div>
        </Modal>
      )}

      {/* Clear cache confirm */}
      {showClearCache && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5" onClick={() => !clearingCache && setShowClearCache(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500 text-white">
              <Trash2 className="h-6 w-6" />
            </div>
            <h2 className="mb-1 text-lg font-bold">مسح التخزين المؤقت؟</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              سيتم حذف الملفات المؤقتة والصور المخزّنة محليًا لتفريغ المساحة وحلّ بعض المشاكل. لن يتم حذف حسابك أو رسائلك على الخادم. قد يحتاج التطبيق للاتصال بالإنترنت لإعادة تحميل المحتوى.
            </p>
            <div className="flex gap-2">
              <button disabled={clearingCache} onClick={() => setShowClearCache(false)}
                className="h-11 flex-1 rounded-xl border border-input font-semibold">إلغاء</button>
              <button disabled={clearingCache} onClick={clearCache}
                className="h-11 flex-1 rounded-xl bg-rose-500 text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {clearingCache ? <><Loader2 className="h-4 w-4 animate-spin" /> ...</> : "مسح"}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>

  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

function IconBox({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-white shadow ${color}`}>
      {children}
    </div>
  );
}

function Row({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to as any} className="flex items-center justify-between p-4 active:bg-secondary/60">
      <div className="flex items-center gap-3">
        <IconBox color="bg-primary"><Icon className="h-4 w-4" /></IconBox>
        <span className="font-medium">{label}</span>
      </div>
      <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
    </Link>
  );
}

function FeatureTile({ to, icon: Icon, title, subtitle, gradient }: {
  to: string; icon: any; title: string; subtitle: string; gradient: string;
}) {
  return (
    <Link to={to as any} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-4 text-white shadow-lg active:scale-[0.98] transition`}>
      <div className="absolute -end-4 -top-4 h-20 w-20 rounded-full bg-white/15 blur-xl" />
      <Icon className="h-6 w-6 mb-2 drop-shadow" />
      <div className="text-base font-extrabold leading-tight">{title}</div>
      <div className="text-[11px] opacity-90">{subtitle}</div>
    </Link>
  );
}

function Modal({ title, onClose, icon, color, children }: { title: string; onClose: () => void; icon: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card/95 backdrop-blur px-5 py-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow ${color}`}>{icon}</div>
          <h2 className="flex-1 text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Intro({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-fuchsia-500/10 p-4 text-sm leading-relaxed border border-primary/20">{children}</div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 p-4 text-start active:bg-secondary/60">
        <span className="font-semibold text-sm flex-1">{q}</span>
        <ChevronLeft className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "-rotate-90" : "rtl:rotate-180"}`} />
      </button>
      {open && <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{a}</div>}
    </div>
  );
}

function Section2({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-4">
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      <div className="text-xs text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

function Row2({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function ShareTarget({ label, color, onClick, icon }: { label: string; color: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 active:scale-95 transition">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg ${color}`}>{icon}</div>
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
