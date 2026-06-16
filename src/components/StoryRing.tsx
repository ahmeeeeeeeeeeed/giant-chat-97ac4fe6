import { useNavigate } from "@tanstack/react-router";
import { useUserHasStory } from "@/lib/use-stories";

/**
 * Wraps any avatar/child. If the user has an active story, draws an
 * Instagram-style gradient ring around it and opens the Story Viewer
 * on click (stops event propagation).
 */
export function StoryRing({
  userId,
  children,
  size = "md",
  disableNav = false,
}: {
  userId?: string | null;
  children: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  disableNav?: boolean;
}) {
  const has = useUserHasStory(userId);
  const navigate = useNavigate();

  if (!userId || !has) return <>{children}</>;

  const pad = size === "xs" ? "p-[1.5px]" : size === "sm" ? "p-[2px]" : "p-[2.5px]";

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if (disableNav) return;
        e.preventDefault();
        e.stopPropagation();
        navigate({ to: "/app/stories", search: { user: userId } as any });
      }}
      onKeyDown={(e) => {
        if (disableNav) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          navigate({ to: "/app/stories", search: { user: userId } as any });
        }
      }}
      className={`relative inline-flex items-center justify-center rounded-full ${pad} bg-[conic-gradient(from_0deg,#f59e0b,#ef4444,#ec4899,#8b5cf6,#3b82f6,#10b981,#f59e0b)] shadow-[0_0_10px_-2px_rgba(236,72,153,0.6)] cursor-pointer`}
      aria-label="عرض القصة"
    >
      <span className="block rounded-full bg-background p-[1.5px]">
        {children}
      </span>
    </span>
  );
}
