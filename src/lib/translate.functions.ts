import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LANG_NAMES: Record<string, string> = {
  ar: "Arabic", en: "English", fr: "French", es: "Spanish", de: "German",
  it: "Italian", pt: "Portuguese", ru: "Russian", tr: "Turkish", fa: "Persian",
  ur: "Urdu", he: "Hebrew", hi: "Hindi", zh: "Chinese (Simplified)",
  ja: "Japanese", ko: "Korean", id: "Indonesian", ms: "Malay",
  vi: "Vietnamese", th: "Thai", nl: "Dutch", pl: "Polish", sv: "Swedish",
};

export const translateBatch = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      texts: z.array(z.string().min(1).max(500)).min(1).max(60),
      target: z.string().min(2).max(5),
      source: z.string().min(2).max(5).default("ar"),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
    const targetName = LANG_NAMES[data.target] ?? data.target;
    const sourceName = LANG_NAMES[data.source] ?? data.source;
    if (data.target === data.source) return { translations: data.texts };

    const userPrompt =
      `Translate the following ${sourceName} UI strings to ${targetName}. ` +
      `Return ONLY a JSON array of strings, same length and order. ` +
      `Keep emojis, numbers, placeholders like {{name}} and HTML entities intact. ` +
      `Keep brand name "Giant" untranslated. Be concise; this is UI text.\n\n` +
      JSON.stringify(data.texts);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a precise UI string translator. Respond with a JSON array only — no prose, no markdown fences." },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`AI gateway error ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    let content = json.choices?.[0]?.message?.content ?? "[]";
    content = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { parsed = data.texts; }
    if (!Array.isArray(parsed) || parsed.length !== data.texts.length) {
      return { translations: data.texts };
    }
    return { translations: parsed.map((s) => (typeof s === "string" ? s : "")) };
  });
