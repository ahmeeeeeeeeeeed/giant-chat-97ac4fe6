import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/app/chats")({
  component: ChatsPage,
});

function ChatsPage() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
        <h1 className="text-2xl font-extrabold">المحادثات</h1>
        <p className="text-xs text-muted-foreground">محادثاتك الخاصة</p>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
          <MessageSquare className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">المحادثات الخاصة قريبًا</h3>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          سنفتح هنا المحادثات بينك وبين الأعضاء الآخرين مع الصور والرسائل الصوتية.
        </p>
      </div>
    </main>
  );
}
