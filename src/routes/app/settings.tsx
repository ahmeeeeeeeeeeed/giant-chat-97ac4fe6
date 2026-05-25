import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTheme } from "@/lib/theme";
import { signOut } from "@/lib/auth";
import { Moon, Sun, LogOut, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <h1 className="text-2xl font-extrabold">الإعدادات</h1>
      </header>

      <div className="flex flex-col gap-3 px-4 py-5">
        <Section title="المظهر">
          <button onClick={toggle} className="flex w-full items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              <span className="font-medium">{theme === "dark" ? "الوضع الليلي" : "الوضع الفاتح"}</span>
            </div>
            <span className="text-xs text-muted-foreground">انقر للتبديل</span>
          </button>
        </Section>

        <Section title="عام">
          <Row label="اللغة" value="العربية" />
          <Row label="الإصدار" value="1.0.0" />
        </Section>

        <button
          onClick={handleLogout}
          className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 py-3.5 font-semibold text-destructive"
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </button>
      </div>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-4">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        {value}
        <ChevronLeft className="h-4 w-4" />
      </div>
    </div>
  );
}
