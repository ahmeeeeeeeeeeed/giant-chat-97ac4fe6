import { useState } from "react";
import { toast } from "sonner";
import { Crown, Loader2, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createPremiumByPoints, adminCreatePremium } from "@/lib/premium.functions";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "points" | "admin";
  onCreated?: (info: { username: string }) => void;
};

export function PremiumCreateModal({ open, onClose, mode, onCreated }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const createByPoints = useServerFn(createPremiumByPoints);
  const createByAdmin = useServerFn(adminCreatePremium);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || password.length < 6) {
      toast.error("اسم مستخدم صالح وكلمة مرور (6 أحرف فأكثر)");
      return;
    }
    setBusy(true);
    try {
      const fn = mode === "admin" ? createByAdmin : createByPoints;
      const res = await fn({ data: { username: username.trim(), password } });
      toast.success(`تم إنشاء الحساب المميز: ${res.username}`);
      onCreated?.({ username: res.username });
      setUsername(""); setPassword("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ في الإنشاء");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            <h2 className="font-extrabold">إنشاء حساب مميز</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {mode === "points" ? (
          <p className="mb-3 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            💎 يتم خصم <b>50,000 نقطة</b> من رصيدك عند الإنشاء. يدعم الأسماء العربية والمزخرفة.
          </p>
        ) : (
          <p className="mb-3 rounded-xl bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-400">
            🛠️ إنشاء مباشر من الإدارة (بدون خصم نقاط).
          </p>
        )}

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-muted-foreground">اسم المستخدم المميز</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="مثال: ★ سلطان ★"
              maxLength={30}
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-muted-foreground">كلمة المرور</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6 أحرف على الأقل"
              minLength={6}
              dir="ltr"
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mt-1 flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 font-bold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "تأكيد الإنشاء"}
          </button>
        </form>
      </div>
    </div>
  );
}
