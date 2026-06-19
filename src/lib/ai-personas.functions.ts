import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

/** Create a brand-new AI persona: spawns an auth user + flags profile as AI + ai_personas row. */
export const createAiPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        username: z.string().min(2).max(40),
        displayName: z.string().min(1).max(60),
        bio: z.string().max(300).optional().default(""),
        avatarUrl: z.string().url().optional().nullable(),
        personaType: z.string().min(1).max(40).default("friendly"),
        postIntervalMinutes: z.number().int().min(15).max(7 * 24 * 60).default(180),
        reactionRate: z.number().min(0).max(1).default(0.3),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create a real auth user (uses random throwaway email; AI accounts never sign in)
    const email = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@ai.local`;
    const password = crypto.randomUUID() + crypto.randomUUID();
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: data.username },
    });
    if (cErr || !created.user) throw new Error(cErr?.message || "Failed to create user");

    const uid = created.user.id;

    // Make sure profile is flagged AI + carries the supplied bio/avatar
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({
        is_ai: true,
        username: data.username,
        bio: data.bio || null,
        avatar_url: data.avatarUrl || null,
        dm_locked: true, // block DMs to AI accounts by default
      })
      .eq("id", uid);
    if (pErr) throw new Error(pErr.message);

    // Insert the persona record
    const { data: persona, error: aErr } = await supabaseAdmin
      .from("ai_personas")
      .insert({
        profile_id: uid,
        display_name: data.displayName,
        bio: data.bio || null,
        avatar_url: data.avatarUrl || null,
        persona_type: data.personaType,
        post_interval_minutes: data.postIntervalMinutes,
        reaction_rate: data.reactionRate,
      } as any)
      .select("*")
      .single();
    if (aErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => null);
      throw new Error(aErr.message);
    }
    return { persona };
  });

export const updateAiPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            display_name: z.string().min(1).max(60).optional(),
            bio: z.string().max(300).optional().nullable(),
            avatar_url: z.string().url().optional().nullable(),
            persona_type: z.string().min(1).max(40).optional(),
            is_active: z.boolean().optional(),
            post_interval_minutes: z.number().int().min(15).max(7 * 24 * 60).optional(),
            reaction_rate: z.number().min(0).max(1).optional(),
          })
          .strict(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("ai_personas")
      .update(data.patch as any)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    // Mirror avatar/bio onto profile
    if (data.patch.avatar_url !== undefined || data.patch.bio !== undefined) {
      await supabaseAdmin
        .from("profiles")
        .update({
          ...(data.patch.avatar_url !== undefined ? { avatar_url: data.patch.avatar_url } : {}),
          ...(data.patch.bio !== undefined ? { bio: data.patch.bio } : {}),
        })
        .eq("id", row.profile_id);
    }
    return { persona: row };
  });

export const deleteAiPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("ai_personas")
      .select("profile_id")
      .eq("id", data.id)
      .single();
    if (row) {
      await supabaseAdmin.from("ai_personas").delete().eq("id", data.id);
      await supabaseAdmin.auth.admin.deleteUser(row.profile_id).catch(() => null);
    }
    return { ok: true };
  });

export const addPersonaTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        persona_type: z.string().min(1).max(40),
        kind: z.enum(["post", "story", "comment", "reply"]),
        content: z.string().min(1).max(2000),
        media_url: z.string().url().optional().nullable(),
        weight: z.number().int().min(1).max(100).default(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("ai_persona_templates")
      .insert(data as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { template: row };
  });

export const deletePersonaTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ai_persona_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ────────────────────────────────────────────────────────────────────────────
// Cycle runner
// ────────────────────────────────────────────────────────────────────────────
async function pickWeighted<T extends Record<string, any>>(rows: T[]): Promise<T | null> {
  if (!rows.length) return null;
  const total = rows.reduce((s, r) => s + Math.max(1, Number(r.weight) || 1), 0);
  let n = Math.random() * total;
  for (const r of rows) {
    n -= Math.max(1, Number(r.weight) || 1);
    if (n <= 0) return r;
  }
  return rows[0];
}


async function runCycleInternal() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const stats = { personas: 0, posts: 0, stories: 0, likes: 0, comments: 0, errors: [] as string[], seeded: false };

  // Auto-bootstrap: if DB is empty, seed defaults so the system is fully self-starting.
  const { count: existing } = await supabaseAdmin
    .from("ai_personas")
    .select("id", { count: "exact", head: true });
  if (!existing || existing === 0) {
    console.log("[ai-personas] empty DB — auto-seeding defaults");
    try {
      const r = await seedDefaultsInternal();
      stats.seeded = true;
      console.log("[ai-personas] auto-seed result", r);
    } catch (e) {
      console.error("[ai-personas] auto-seed failed", e);
      stats.errors.push("autoseed:" + (e instanceof Error ? e.message : String(e)));
    }
  }

  const { data: personas, error: pErr } = await supabaseAdmin
    .from("ai_personas")
    .select("*")
    .eq("is_active", true);
  if (pErr) {
    console.error("[ai-personas] fetch personas failed:", pErr.message);
    return { processed: 0, ...stats, errors: ["fetch:" + pErr.message] };
  }
  stats.personas = personas?.length || 0;
  console.log(`[ai-personas] cycle start — active personas: ${stats.personas}`);
  if (!personas || personas.length === 0) return { processed: 0, ...stats };

  for (const p of personas) {
    try {
      const lastPost = p.last_post_at ? new Date(p.last_post_at).getTime() : 0;
      const intervalMs = (p.post_interval_minutes || 180) * 60_000;
      const dueToPost = now.getTime() - lastPost >= intervalMs;
      console.log(`[ai-personas] ${p.display_name} due=${dueToPost} lastPost=${p.last_post_at || "never"}`);

      if (dueToPost) {
        const { data: tpls } = await supabaseAdmin
          .from("ai_persona_templates")
          .select("*")
          .eq("persona_type", p.persona_type)
          .in("kind", ["post", "story"]);
        const tpl = await pickWeighted((tpls || []) as any);
        if (!tpl) {
          console.warn(`[ai-personas] no post/story templates for type=${p.persona_type}`);
        } else if (tpl.kind === "post") {
          const { data: post, error } = await supabaseAdmin
            .from("community_posts")
            .insert({
              author_id: p.profile_id,
              content: tpl.content,
              media_url: tpl.media_url || null,
              media_type: tpl.media_url ? "image" : null,
            } as any).select("id").single();
          if (error) { stats.errors.push("post:" + error.message); console.error("[ai-personas] post err", error.message); }
          else {
            stats.posts++;
            await supabaseAdmin.from("ai_persona_activity_log").insert({ persona_id: p.id, action: "post", target_id: post?.id || null } as any);
            await supabaseAdmin.from("ai_personas").update({ last_post_at: now.toISOString() } as any).eq("id", p.id);
          }
        } else {
          const { data: story, error } = await supabaseAdmin
            .from("stories")
            .insert({
              user_id: p.profile_id,
              content: tpl.content,
              media_url: tpl.media_url || null,
              media_type: tpl.media_url ? "image" : null,
            } as any).select("id").single();
          if (error) { stats.errors.push("story:" + error.message); console.error("[ai-personas] story err", error.message); }
          else {
            stats.stories++;
            await supabaseAdmin.from("ai_persona_activity_log").insert({ persona_id: p.id, action: "story", target_id: story?.id || null } as any);
            await supabaseAdmin.from("ai_personas").update({ last_post_at: now.toISOString() } as any).eq("id", p.id);
          }
        }
      }

      // Reactions — first cycle (last_react_at null) always fires to seed visible activity.
      const firstRun = !p.last_react_at;
      const shouldReact = firstRun || Math.random() < Number(p.reaction_rate || 0);
      if (shouldReact) {
        const since = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
        const { data: recent } = await supabaseAdmin
          .from("community_posts")
          .select("id, author_id")
          .gte("created_at", since)
          .neq("author_id", p.profile_id)
          .order("created_at", { ascending: false })
          .limit(20);
        const pool = (recent || []).slice(0, 10);
        const likeTargets = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
        for (const t of likeTargets) {
          const { error } = await supabaseAdmin
            .from("community_reactions")
            .upsert({ post_id: t.id, user_id: p.profile_id, reaction: "like" } as any);
          if (!error) {
            stats.likes++;
            await supabaseAdmin.from("ai_persona_activity_log").insert({ persona_id: p.id, action: "like", target_id: t.id } as any);
          }
        }
        const { data: cTpls } = await supabaseAdmin
          .from("ai_persona_templates")
          .select("*")
          .eq("persona_type", p.persona_type)
          .eq("kind", "comment");
        const cTpl = await pickWeighted((cTpls || []) as any);
        if (cTpl && pool.length) {
          const target = pool[Math.floor(Math.random() * pool.length)];
          const { data: comment, error } = await supabaseAdmin
            .from("community_comments")
            .insert({ post_id: target.id, author_id: p.profile_id, content: cTpl.content } as any)
            .select("id").single();
          if (!error) {
            stats.comments++;
            await supabaseAdmin.from("ai_persona_activity_log").insert({ persona_id: p.id, action: "comment", target_id: comment?.id || null } as any);
          }
        }
        await supabaseAdmin.from("ai_personas").update({ last_react_at: now.toISOString() } as any).eq("id", p.id);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ai-personas] persona ${p.id} failed:`, msg);
      stats.errors.push("persona:" + msg);
    }
  }

  const processed = stats.posts + stats.stories + stats.likes + stats.comments;
  console.log("[ai-personas] cycle done", { processed, ...stats });
  return { processed, ...stats };
}

export const runPersonaCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    return await runCycleInternal();
  });

// Shared internal seed body — called by the public server fn AND by the auto-bootstrap in runCycleInternal.
async function seedDefaultsInternal() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const defaults = [
    // friendly (8)
    { username: "nora_ai", displayName: "نورا", bio: "أحب الحياة والإيجابية ✨", personaType: "friendly", postIntervalMinutes: 180, reactionRate: 0.6 },
    { username: "sara_ai", displayName: "سارة", bio: "ابتسامة كل يوم 🌸", personaType: "friendly", postIntervalMinutes: 200, reactionRate: 0.55 },
    { username: "lana_ai", displayName: "لانا", bio: "طاقة إيجابية دائمًا 💫", personaType: "friendly", postIntervalMinutes: 220, reactionRate: 0.5 },
    { username: "rana_ai", displayName: "رنا", bio: "صديقة الكل 💙", personaType: "friendly", postIntervalMinutes: 240, reactionRate: 0.5 },
    { username: "huda_ai", displayName: "هدى", bio: "أحب القراءة والهدوء 📖", personaType: "friendly", postIntervalMinutes: 260, reactionRate: 0.45 },
    { username: "omar_ai", displayName: "عمر", bio: "متفائل دائمًا ☀️", personaType: "friendly", postIntervalMinutes: 200, reactionRate: 0.55 },
    { username: "ali_ai", displayName: "علي", bio: "محب للسفر والاكتشاف ✈️", personaType: "friendly", postIntervalMinutes: 280, reactionRate: 0.4 },
    { username: "mona_ai", displayName: "منى", bio: "فنانة وحالمة 🎨", personaType: "friendly", postIntervalMinutes: 240, reactionRate: 0.5 },
    // news (6)
    { username: "news_ai", displayName: "أخبار سريعة", bio: "آخر الأخبار والتحديثات", personaType: "news", postIntervalMinutes: 240, reactionRate: 0.4 },
    { username: "tech_ai", displayName: "تك نيوز", bio: "كل جديد التقنية 💻", personaType: "news", postIntervalMinutes: 300, reactionRate: 0.35 },
    { username: "sport_ai", displayName: "رياضة اليوم", bio: "نتائج وأخبار الرياضة ⚽", personaType: "news", postIntervalMinutes: 240, reactionRate: 0.4 },
    { username: "world_ai", displayName: "حول العالم", bio: "أخبار عالمية 🌍", personaType: "news", postIntervalMinutes: 360, reactionRate: 0.3 },
    { username: "trend_ai", displayName: "ترند", bio: "كل ما هو رائج 🔥", personaType: "news", postIntervalMinutes: 200, reactionRate: 0.5 },
    { username: "tips_ai", displayName: "نصائح يومية", bio: "نصيحة كل يوم 💡", personaType: "news", postIntervalMinutes: 300, reactionRate: 0.35 },
    // gamer (6)
    { username: "gamer_ai", displayName: "اللاعب", bio: "ألعاب ومنافسات 🎮", personaType: "gamer", postIntervalMinutes: 360, reactionRate: 0.5 },
    { username: "pro_ai", displayName: "برو بلاير", bio: "محترف ألعاب 🏆", personaType: "gamer", postIntervalMinutes: 300, reactionRate: 0.5 },
    { username: "fps_ai", displayName: "FPS Master", bio: "عشاق التصويب 🎯", personaType: "gamer", postIntervalMinutes: 360, reactionRate: 0.45 },
    { username: "moba_ai", displayName: "موبا فان", bio: "ألعاب الفرق والاستراتيجية", personaType: "gamer", postIntervalMinutes: 360, reactionRate: 0.4 },
    { username: "stream_ai", displayName: "ستريمر", bio: "بث مباشر يومي 🎥", personaType: "gamer", postIntervalMinutes: 240, reactionRate: 0.55 },
    { username: "retro_ai", displayName: "ريترو", bio: "ألعاب الزمن الجميل 👾", personaType: "gamer", postIntervalMinutes: 400, reactionRate: 0.35 },
  ];
  let createdPersonas = 0;
  for (const d of defaults) {
    const email = `ai_${d.username}_${Date.now()}@ai.local`;
    const password = crypto.randomUUID() + crypto.randomUUID();
    const { data: u, error: ue } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { username: d.username },
    });
    if (ue || !u.user) { console.error("seed user err", ue?.message); continue; }
    const uid = u.user.id;
    await supabaseAdmin.from("profiles").update({
      is_ai: true, username: d.username, bio: d.bio, dm_locked: true,
    }).eq("id", uid);
    const { error: ie } = await supabaseAdmin.from("ai_personas").insert({
      profile_id: uid, display_name: d.displayName, bio: d.bio, persona_type: d.personaType,
      post_interval_minutes: d.postIntervalMinutes, reaction_rate: d.reactionRate,
    } as any);
    if (!ie) createdPersonas++;
  }

  const templates: any[] = [
    { persona_type: "friendly", kind: "post", content: "صباح الخير جميعاً ☀️ يوم مليء بالطاقة الإيجابية", weight: 3 },
    { persona_type: "friendly", kind: "post", content: "ابتسامة بسيطة قد تغيّر يوم شخص ما 🌸", weight: 2 },
    { persona_type: "friendly", kind: "post", content: "كيف يومكم يا أصدقاء؟ شاركونا 💬", weight: 2 },
    { persona_type: "friendly", kind: "story", content: "كونوا لطفاء مع أنفسكم اليوم 💙", weight: 1 },
    { persona_type: "friendly", kind: "comment", content: "كلام جميل 👏", weight: 2 },
    { persona_type: "friendly", kind: "comment", content: "أتفق معك تماماً", weight: 1 },
    { persona_type: "friendly", kind: "comment", content: "❤️❤️", weight: 2 },
    { persona_type: "friendly", kind: "comment", content: "ما شاء الله 🌸", weight: 1 },
    { persona_type: "news", kind: "post", content: "تحديث: ميزات جديدة قادمة قريباً للتطبيق 🚀", weight: 2 },
    { persona_type: "news", kind: "post", content: "نصيحة اليوم: استخدم الغرف الصوتية للتعرف على أصدقاء جدد", weight: 2 },
    { persona_type: "news", kind: "post", content: "هل جربت الميزات الجديدة؟ شاركنا رأيك 📢", weight: 2 },
    { persona_type: "news", kind: "comment", content: "خبر مهم 👌", weight: 1 },
    { persona_type: "news", kind: "comment", content: "متابع 👀", weight: 1 },
    { persona_type: "gamer", kind: "post", content: "من معي للعب الآن؟ 🎮", weight: 2 },
    { persona_type: "gamer", kind: "post", content: "بطولة جديدة قريباً — جهّزوا أنفسكم!", weight: 1 },
    { persona_type: "gamer", kind: "post", content: "أفضل لعبة لعبتها هذا الأسبوع 🔥", weight: 2 },
    { persona_type: "gamer", kind: "story", content: "GG! 🏆", weight: 1 },
    { persona_type: "gamer", kind: "comment", content: "🔥🔥", weight: 2 },
    { persona_type: "gamer", kind: "comment", content: "GG WP 🎮", weight: 1 },
  ];
  let createdTemplates = 0;
  for (const t of templates) {
    const { error } = await supabaseAdmin.from("ai_persona_templates").insert(t as any);
    if (!error) createdTemplates++;
  }
  return { personas: createdPersonas, templates: createdTemplates };
}

// Bootstraps 20 demo personas + content templates when the system is empty.
export const seedDefaultPersonas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    return await seedDefaultsInternal();
  });

export { runCycleInternal as __runCycleInternal };

