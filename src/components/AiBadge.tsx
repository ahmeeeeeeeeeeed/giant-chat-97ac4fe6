import { Bot } from "lucide-react";

type Props = {
  size?: "xs" | "sm" | "md";
  className?: string;
  label?: string;
};

/**
 * Visible "AI" badge shown next to usernames belonging to system-managed personas.
 * Keeps transparency: users always know a profile is automated.
 */
export function AiBadge({ size = "xs", className = "", label = "AI" }: Props) {
  const h = size === "md" ? "h-5" : size === "sm" ? "h-[18px]" : "h-[16px]";
  const text = size === "md" ? "text-[11px]" : "text-[10px]";
  const icon = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";
  return (
    <span
      title="حساب يديره النظام"
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full bg-gradient-to-l from-sky-500 to-cyan-500 px-1.5 ${h} ${text} font-extrabold text-white shadow-sm ${className}`}
    >
      <Bot className={icon} />
      {label}
    </span>
  );
}
