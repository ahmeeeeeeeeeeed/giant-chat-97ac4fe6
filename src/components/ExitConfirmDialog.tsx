import { useEffect, useState } from "react";

const EVENT = "giant:exit-confirm";

export function requestExitConfirm() {
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function ExitConfirmDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);

  if (!open) return null;

  const cancel = () => setOpen(false);
  const exit = async () => {
    setOpen(false);
    try {
      const { App } = await import("@capacitor/app");
      await App.exitApp();
    } catch {
      /* not in native — ignore */
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm animate-in fade-in"
      onClick={cancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-2xl"
      >
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-2xl">
          🚪
        </div>
        <h2 className="text-lg font-extrabold">هل تريد الخروج من التطبيق؟</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          يمكنك العودة في أي وقت.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={cancel}
            className="h-11 flex-1 rounded-2xl border border-border bg-background font-semibold"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={exit}
            className="h-11 flex-1 rounded-2xl bg-destructive font-semibold text-destructive-foreground"
          >
            خروج
          </button>
        </div>
      </div>
    </div>
  );
}
