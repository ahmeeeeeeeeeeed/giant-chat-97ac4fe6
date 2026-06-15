// Public HTTP endpoint for YouTube search. Exists so the Capacitor APK
// (which runs the SPA from https://localhost) can hit an absolute URL
// instead of relying on relative serverFn calls that resolve to the
// device itself. CORS is wide-open since this is a read-only YouTube
// search proxy with no auth or user data.
import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

function parseDuration(text: string | undefined | null): number {
  if (!text) return 0;
  const parts = text.split(":").map((p) => Number(p));
  if (parts.some((n) => !isFinite(n))) return 0;
  let s = 0;
  for (const p of parts) s = s * 60 + p;
  return s * 1000;
}

async function search(q: string) {
  const res = await fetch(
    "https://www.youtube.com/youtubei/v1/search?prettyPrint=false",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      body: JSON.stringify({
        context: {
          client: { clientName: "WEB", clientVersion: "2.20240101.00.00", hl: "en", gl: "US" },
        },
        query: q,
        params: "EgIQAQ%3D%3D",
      }),
    },
  );
  if (!res.ok) return { track: null, error: `search failed (${res.status})` };
  const json: any = await res.json();
  const sections =
    json?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents ?? [];
  for (const sec of sections) {
    const items = sec?.itemSectionRenderer?.contents ?? [];
    for (const it of items) {
      const v = it?.videoRenderer;
      if (!v?.videoId) continue;
      const lengthText: string | undefined =
        v?.lengthText?.simpleText ?? v?.lengthText?.runs?.[0]?.text;
      if (!lengthText) continue;
      const durMs = parseDuration(lengthText);
      if (durMs <= 0) continue;
      const title: string = v?.title?.runs?.[0]?.text ?? v?.title?.simpleText ?? "Unknown";
      const artist: string =
        v?.ownerText?.runs?.[0]?.text ?? v?.longBylineText?.runs?.[0]?.text ?? "Unknown";
      const thumbs = v?.thumbnail?.thumbnails ?? [];
      const artwork = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
      return {
        track: {
          videoId: v.videoId,
          title,
          artist,
          artwork,
          duration_ms: durMs,
          preview_url: `https://www.youtube.com/watch?v=${v.videoId}`,
        },
        error: null as string | null,
      };
    }
  }
  return { track: null, error: "no_results" };
}

export const Route = createFileRoute("/api/public/search-track")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") || "").trim().slice(0, 200);
        if (!q) {
          return new Response(JSON.stringify({ track: null, error: "missing_query" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
        try {
          const result = await search(q);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ track: null, error: e instanceof Error ? e.message : "unknown" }),
            { status: 200, headers: { "Content-Type": "application/json", ...CORS } },
          );
        }
      },
    },
  },
});
