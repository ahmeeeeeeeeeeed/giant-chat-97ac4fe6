import { createFileRoute, Link } from "@tanstack/react-router";
import { WifiOff, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/offline")({
  component: OfflinePage,
  head: () => ({
    meta: [{ title: "غير متصل — Giant" }],
  }),
});

function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-500/30">
          <WifiOff className="h-7 w-7 text-amber-400" />
        </div>
        <h1 className="text-xl font-bold text-foreground">لا يوجد اتصال بالإنترنت</h1>
        <p className="text-sm text-muted-foreground">
          يمكنك متابعة تصفّح البيانات المحفوظة محليًا. سيستأنف التطبيق المزامنة تلقائيًا عند عودة الاتصال.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <RefreshCw className="h-4 w-4" />
            إعادة المحاولة
          </button>
          <Link
            to="/app/chats"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            فتح المحادثات
          </Link>
        </div>
      </div>
    </div>
  );
}
