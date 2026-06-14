import { useEffect, useState } from "react";
import { LogOut, DoorOpen, X, Loader2 } from "lucide-react";
import { signOut } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";

const EVENT = "giant:exit-confirm";

export function requestExitConfirm() {
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function ExitConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "exit" | "signout">(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);

  if (!open) return null;

  const cancel = () => { if (!busy) setOpen(false); };

  const exit = async () => {
    setBusy("exit");
    try {
      const { App } = await import("@capacitor/app");
      await App.exitApp();
    } catch {
      window.close();
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  const doSignOut = async () => {
    setBusy("signout");
    try {
      await signOut();
      setOpen(false);
      navigate({ to: "/" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in"
      onClick={cancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4"
      >
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-2xl">
          🚪
        </div>
        <h2 className="text-lg font-extrabold">هل تريد الخروج؟</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          اختر خروج من التطبيق أو تسجيل الخروج من حسابك.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={exit}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-destructive font-semibold text-destructive-foreground disabled:opacity-60"
          >
            {busy === "exit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
            خروج من التطبيق
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={doSignOut}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background font-semibold disabled:opacity-60"
          >
            {busy === "signout" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            تسجيل الخروج
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={cancel}
            className="flex h-10 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-muted-foreground disabled:opacity-60"
          >
            <X className="h-4 w-4" />
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
