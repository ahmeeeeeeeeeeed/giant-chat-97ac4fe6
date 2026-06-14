import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type TrackResult = {
  videoId: string;
  title: string;
  artist: string;
  artwork: string;
  duration_ms: number;
  preview_url: string; // youtube watch URL — kept for backwards compat
};

function parseDuration(text: string | undefined | null): number {
  if (!text) return 0;
  const parts = text.split(":").map((p) => Number(p));
  if (parts.some((n) => !isFinite(n))) return 0;
  let s = 0;
  for (const p of parts) s = s * 60 + p;
  return s * 1000;
}

// YouTube search — scrapes ytInitialData from the public search page so we
// don't need an API key. Returns the first watchable video.
export const searchTrack = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ q: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }): Promise<{ track: TrackResult | null; error: string | null }> => {
    try {
      // Use YouTube InnerTube API directly — returns clean JSON and is
      // reliable on edge runtimes (no regex on huge HTML, no CPU timeouts).
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
              client: {
                clientName: "WEB",
                clientVersion: "2.20240101.00.00",
                hl: "en",
                gl: "US",
              },
            },
            query: data.q,
            // EgIQAQ%3D%3D == filter: videos only
            params: "EgIQAQ%3D%3D",
          }),
        },
      );
      if (!res.ok) return { track: null, error: `search failed (${res.status})` };
      const json: any = await res.json();
      const sections =
        json?.contents?.twoColumnSearchResultsRenderer?.primaryContents
          ?.sectionListRenderer?.contents ??
        json?.onResponseReceivedCommands?.[0]?.appendContinuationItemsAction
          ?.continuationItems ??
        [];
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
          const title: string =
            v?.title?.runs?.[0]?.text ?? v?.title?.simpleText ?? "Unknown";
          const artist: string =
            v?.ownerText?.runs?.[0]?.text ??
            v?.longBylineText?.runs?.[0]?.text ??
            "Unknown";
          const thumbs = v?.thumbnail?.thumbnails ?? [];
          const artwork =
            thumbs[thumbs.length - 1]?.url ||
            `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
          return {
            track: {
              videoId: v.videoId,
              title,
              artist,
              artwork,
              duration_ms: durMs,
              preview_url: `https://www.youtube.com/watch?v=${v.videoId}`,
            },
            error: null,
          };
        }
      }
      return { track: null, error: "no_results" };
    } catch (e) {
      return { track: null, error: e instanceof Error ? e.message : "unknown" };
    }
  });

export const getTrivia = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const res = await fetch("https://opentdb.com/api.php?amount=1&type=multiple");
    const json = (await res.json()) as {
      results?: Array<{
        question: string;
        correct_answer: string;
        incorrect_answers: string[];
        category: string;
      }>;
    };
    const r = json.results?.[0];
    if (!r) return { question: null as null | { q: string; answer: string; choices: string[]; category: string } };
    const decode = (s: string) =>
      s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    const choices = [...r.incorrect_answers.map(decode), decode(r.correct_answer)].sort(() => Math.random() - 0.5);
    return { question: { q: decode(r.question), answer: decode(r.correct_answer), choices, category: decode(r.category) } };
  } catch {
    return { question: null };
  }
});
