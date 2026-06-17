import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SiteAuthProvider } from "@/lib/site-auth";

export const Route = createFileRoute("/site")({
  component: SiteLayout,
});

function SiteLayout() {
  return (
    <SiteAuthProvider>
      <Outlet />
    </SiteAuthProvider>
  );
}
