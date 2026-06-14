import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function extractIp(req: Request): string | null {
  const h = req.headers;
  const cand =
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    h.get("true-client-ip");
  return cand || null;
}

export const recordLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const req = getRequest();
    const ip = req ? extractIp(req) : null;
    const ua = req?.headers.get("user-agent") ?? null;

    let country: string | null = null;
    let country_code: string | null = null;
    let city: string | null = null;
    let region: string | null = null;

    if (ip) {
      try {
        const r = await fetch(`https://ipapi.co/${ip}/json/`, {
          headers: { "User-Agent": "giant-chat/1.0" },
        });
        if (r.ok) {
          const j = (await r.json()) as {
            country_name?: string;
            country_code?: string;
            city?: string;
            region?: string;
          };
          country = j.country_name ?? null;
          country_code = j.country_code ?? null;
          city = j.city ?? null;
          region = j.region ?? null;
        }
      } catch (e) {
        console.warn("[login-history] geo lookup failed", e);
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("login_history").insert({
      user_id: context.userId,
      ip,
      country,
      country_code,
      city,
      region,
      user_agent: ua,
    });
    if (error) {
      console.error("[login-history] insert failed", error);
      throw new Error(error.message);
    }
    return { ok: true };
  });
