import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type TrackResult = {
  title: string;
  artist: string;
  artwork: string;
  preview_url: string;
  duration_ms: number;
};

// Deezer public search — free, no key. Returns 30s preview MP3 + artwork.
export const searchTrack = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ q: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }): Promise<{ track: TrackResult | null; error: string | null }> => {
    try {
      const res = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(data.q)}&limit=1`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return { track: null, error: `search failed (${res.status})` };
      const json = (await res.json()) as {
        data?: Array<{
          title: string;
          preview: string;
          duration: number;
          artist: { name: string };
          album: { cover_medium: string; cover_big: string };
        }>;
      };
      const t = json.data?.[0];
      if (!t || !t.preview) return { track: null, error: "no_results" };
      return {
        track: {
          title: t.title,
          artist: t.artist.name,
          artwork: t.album.cover_big || t.album.cover_medium,
          preview_url: t.preview,
          duration_ms: (t.duration || 30) * 1000,
        },
        error: null,
      };
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
