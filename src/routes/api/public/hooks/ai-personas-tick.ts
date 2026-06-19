import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/ai-personas-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Authenticate via Supabase anon apikey header (canonical pg_cron pattern)
        const apikey = request.headers.get("apikey") || request.headers.get("Apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { __runCycleInternal } = await import("@/lib/ai-personas.functions");
        try {
          const res = await __runCycleInternal();
          return Response.json({ ok: true, ...res });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
