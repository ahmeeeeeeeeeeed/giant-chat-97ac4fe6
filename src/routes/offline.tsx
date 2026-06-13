import { createFileRoute, Link } from "@tanstack/react-router";
import { WifiOff } from "lucide-react";

export const Route = createFileRoute("/offline")({
  component: OfflinePage,
  head: () => ({
    meta: [
      { title: "غير متصل — Giant" },
      { name: "description", content: "لا يوجد اتصال بالإنترنت" },
    ],
  }),
});

function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <WifiOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">أنت غير متصل بالإنترنت</h1>
        <p className="text-muted-foreground">
          يبدو أنه لا يوجد اتصال بالشبكة حاليًا. يمكنك تصفح الصفحات التي زرتها من قبل، وسيتم استئناف
          المزامنة تلقائيًا عند عودة الاتصال.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            إعادة المحاولة
          </button>
          <Link
            to="/"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
          >
            الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
