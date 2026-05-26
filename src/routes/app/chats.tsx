import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/app/chats")({
  component: ChatsPage,
});

function ChatsPage() {
  const { t } = useTranslation();
  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <h1 className="text-2xl font-extrabold">{t("chats.title")}</h1>
        <p className="text-xs text-muted-foreground">{t("chats.subtitle")}</p>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
          <MessageSquare className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">{t("chats.soon")}</h3>
      </div>
    </main>
  );
}
