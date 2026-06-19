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

// Ambient like/comment: persona isn't due to post but drops light activity for realism.
async function ambientReact(supabaseAdmin: any, p: any, stats: any, now: Date) {
  const since = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from("community_posts").select("id, author_id")
    .gte("created_at", since).neq("author_id", p.profile_id)
    .order("created_at", { ascending: false }).limit(30);
  const pool = recent || [];
  if (!pool.length) return;
  // 1 like
  const t = pool[Math.floor(Math.random() * pool.length)];
  const { error: le } = await supabaseAdmin
    .from("community_reactions")
    .upsert({ post_id: t.id, user_id: p.profile_id, reaction: "like" } as any);
  if (!le) {
    stats.likes++;
    await supabaseAdmin.from("ai_persona_activity_log").insert({ persona_id: p.id, action: "like", target_id: t.id } as any);
  }
  // ~50% also a comment
  if (Math.random() < 0.5) {
    const { data: cTpls } = await supabaseAdmin
      .from("ai_persona_templates").select("*")
      .eq("persona_type", p.persona_type).eq("kind", "comment");
    const cTpl = await pickWeighted((cTpls || []) as any);
    if (cTpl) {
      const t2 = pool[Math.floor(Math.random() * pool.length)];
      const { data: comment, error } = await supabaseAdmin
        .from("community_comments")
        .insert({ post_id: t2.id, author_id: p.profile_id, content: cTpl.content } as any)
        .select("id").single();
      if (!error) {
        stats.comments++;
        await supabaseAdmin.from("ai_persona_activity_log").insert({ persona_id: p.id, action: "comment", target_id: comment?.id || null } as any);
      }
    }
  }
  await supabaseAdmin.from("ai_personas")
    .update({ last_react_at: now.toISOString() } as any)
    .eq("id", p.id);
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

  // Shuffle personas so different ones run first each cycle (more realistic)
  const shuffled = [...personas].sort(() => Math.random() - 0.5);

  for (const p of shuffled) {
    try {
      const lastPost = p.last_post_at ? new Date(p.last_post_at).getTime() : 0;
      const intervalMs = (p.post_interval_minutes || 300) * 60_000;
      // Add ±10% random jitter so personas drift apart over time and don't sync
      const jitter = intervalMs * (Math.random() * 0.2 - 0.1);
      const dueToPost = now.getTime() - lastPost >= intervalMs + jitter;
      console.log(`[ai-personas] ${p.display_name} due=${dueToPost} lastPost=${p.last_post_at || "never"}`);

      // Even when not due to post, occasionally drop a like/comment (real-feel ambient activity)
      if (!dueToPost) {
        if (Math.random() < 0.35 * (p.reaction_rate ?? 0.5)) {
          await ambientReact(supabaseAdmin, p, stats, now);
        }
        continue;
      }

      // 1) POST (skip ~15% of the time to avoid robotic punctuality)
      if (Math.random() > 0.15) {
        const { data: postTpls } = await supabaseAdmin
          .from("ai_persona_templates").select("*")
          .eq("persona_type", p.persona_type).eq("kind", "post");
        const postTpl = await pickWeighted((postTpls || []) as any);
        if (postTpl) {
          const { data: post, error } = await supabaseAdmin
            .from("community_posts")
            .insert({
              author_id: p.profile_id,
              content: postTpl.content,
              media_url: postTpl.media_url || null,
              media_type: postTpl.media_url ? "image" : null,
            } as any).select("id").single();
          if (error) { stats.errors.push("post:" + error.message); }
          else {
            stats.posts++;
            await supabaseAdmin.from("ai_persona_activity_log").insert({ persona_id: p.id, action: "post", target_id: post?.id || null } as any);
          }
        }
      }

      // 2) STORY (only ~60% of cycles)
      if (Math.random() < 0.6) {
        const { data: storyTpls } = await supabaseAdmin
          .from("ai_persona_templates").select("*")
          .eq("persona_type", p.persona_type).eq("kind", "story");
        const storyTpl = await pickWeighted((storyTpls || []) as any);
        if (storyTpl) {
          const { data: story, error } = await supabaseAdmin
            .from("stories")
            .insert({
              user_id: p.profile_id,
              content: storyTpl.content,
              media_url: storyTpl.media_url || null,
              media_type: storyTpl.media_url ? "image" : null,
            } as any).select("id").single();
          if (error) { stats.errors.push("story:" + error.message); }
          else {
            stats.stories++;
            await supabaseAdmin.from("ai_persona_activity_log").insert({ persona_id: p.id, action: "story", target_id: story?.id || null } as any);
          }
        }
      }

      // 3) LIKES + 4) COMMENT — randomized counts, not always identical
      const since = new Date(now.getTime() - 48 * 60 * 60_000).toISOString();
      const { data: recent } = await supabaseAdmin
        .from("community_posts").select("id, author_id")
        .gte("created_at", since).neq("author_id", p.profile_id)
        .order("created_at", { ascending: false }).limit(40);
      const pool = (recent || []);
      const likeCount = Math.floor(Math.random() * 4); // 0..3 likes
      const likeTargets = [...pool].sort(() => Math.random() - 0.5).slice(0, likeCount);
      for (const t of likeTargets) {
        const { error } = await supabaseAdmin
          .from("community_reactions")
          .upsert({ post_id: t.id, user_id: p.profile_id, reaction: "like" } as any);
        if (!error) {
          stats.likes++;
          await supabaseAdmin.from("ai_persona_activity_log").insert({ persona_id: p.id, action: "like", target_id: t.id } as any);
        }
      }
      // Comment with ~70% probability
      if (Math.random() < 0.7 && pool.length) {
        const { data: cTpls } = await supabaseAdmin
          .from("ai_persona_templates").select("*")
          .eq("persona_type", p.persona_type).eq("kind", "comment");
        const cTpl = await pickWeighted((cTpls || []) as any);
        if (cTpl) {
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
      }

      // Bump last_post_at with small random offset so next cycle isn't perfectly aligned
      const offsetMin = Math.floor(Math.random() * 30) - 15;
      const stamped = new Date(now.getTime() + offsetMin * 60_000).toISOString();
      await supabaseAdmin.from("ai_personas")
        .update({ last_post_at: stamped, last_react_at: stamped } as any)
        .eq("id", p.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ai-personas] persona ${p.id} failed:`, msg);
      stats.errors.push("persona:" + msg);
    }
  }

  // ── Daily room invites: 3 designated bots each send 1 invite per day to a random user.
  try {
    const inviteStats = await runDailyRoomInvites(supabaseAdmin, now);
    (stats as any).invites = inviteStats.sent;
    if (inviteStats.errors.length) stats.errors.push(...inviteStats.errors);
  } catch (e) {
    stats.errors.push("invites:" + (e instanceof Error ? e.message : String(e)));
  }

  const processed = stats.posts + stats.stories + stats.likes + stats.comments + ((stats as any).invites || 0);
  console.log("[ai-personas] cycle done", { processed, ...stats });
  return { processed, ...stats };
}

// ────────────────────────────────────────────────────────────────────────────
// Daily room invites — 3 bots, 1 invite/day each, random user + random room
// ────────────────────────────────────────────────────────────────────────────
async function runDailyRoomInvites(supabaseAdmin: any, now: Date) {
  const out = { sent: 0, errors: [] as string[] };

  // Pick the 3 oldest active personas as inviters (deterministic).
  const { data: inviters } = await supabaseAdmin
    .from("ai_personas")
    .select("id, profile_id, display_name")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(3);
  if (!inviters?.length) return out;

  // Fetch all rooms once.
  const { data: rooms } = await supabaseAdmin.from("rooms").select("id").limit(200);
  if (!rooms?.length) return out;

  // Fetch human users (new + old): exclude AI profiles. Cap to 500 for fairness.
  const { data: users } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .or("is_ai.is.null,is_ai.eq.false")
    .order("created_at", { ascending: false })
    .limit(500);
  if (!users?.length) return out;

  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();

  for (const bot of inviters) {
    try {
      // Skip if this bot already sent an invite in the last 24h.
      const { count: sentToday } = await supabaseAdmin
        .from("ai_persona_activity_log")
        .select("id", { count: "exact", head: true })
        .eq("persona_id", bot.id).eq("action", "invite")
        .gte("created_at", dayAgo);
      if ((sentToday ?? 0) > 0) continue;

      const room = rooms[Math.floor(Math.random() * rooms.length)];
      // Mix new (top) + old (bottom) — random pick across the full window.
      const target = users[Math.floor(Math.random() * users.length)];
      if (!room || !target || target.id === bot.profile_id) continue;

      const { error } = await supabaseAdmin.from("room_invites").insert({
        room_id: room.id, user_id: target.id, invited_by: bot.profile_id,
      } as any);
      if (error) { out.errors.push("invite:" + error.message); continue; }
      out.sent++;
      await supabaseAdmin.from("ai_persona_activity_log").insert({
        persona_id: bot.id, action: "invite", target_id: room.id,
      } as any);
    } catch (e) {
      out.errors.push("invite:" + (e instanceof Error ? e.message : String(e)));
    }
  }
  return out;
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

  // Badge mapping by persona type (existing shop badges) — replaces the AI badge on profiles.
  const BADGE_BY_TYPE: Record<string, string> = {
    romantic: "9f13228e-c0f9-4fc8-b37d-570bb31af539", // القلب الأحمر
    poetry:   "20822f10-9561-4f46-839c-5d644d8f22c0", // النجمة الذهبية
    hadith:   "aed8029e-3fbf-4b47-95f7-b043d713e80a", // الدرع الفضي
    serious:  "6860e158-444b-4595-b858-89b30fb5e5f2", // المفتاح الذهبي
  };

  const PRAVATAR = (id: number) => `https://i.pravatar.cc/300?img=${id}`;
  const types = ["romantic", "poetry", "hadith", "serious"] as const;

  // 20 unique personas with distinct usernames + Arabic display names + distinct avatars + bios.
  const defaults: Array<{
    username: string; displayName: string; bio: string; avatarUrl: string;
    personaType: typeof types[number]; staggerIndex: number;
  }> = [
    // GIRLS (10) — decorated, attractive display names
    { username: "noor_aldeen",  displayName: "❀ نُور ❀",            bio: "قلبٌ يحبّ الكلام الجميل ✨ • soft soul",  avatarUrl: PRAVATAR(1),  personaType: "romantic", staggerIndex: 0 },
    { username: "lamees_q",     displayName: "✦ لميس ✦",            bio: "بين سطورٍ وأحلام 🌸 • dreamer",          avatarUrl: PRAVATAR(5),  personaType: "poetry",   staggerIndex: 2 },
    { username: "retaj_h",      displayName: "☾ رتاج ☾",            bio: "ذكرٌ ودعاء 🤲 • peaceful heart",         avatarUrl: PRAVATAR(9),  personaType: "hadith",   staggerIndex: 4 },
    { username: "jana_w",       displayName: "✧ Jana • جنى ✧",      bio: "كل يوم أفضل من سابقه 🌿 • grow daily",   avatarUrl: PRAVATAR(10), personaType: "serious",  staggerIndex: 6 },
    { username: "salma_r",      displayName: "♡ سَلمى ♡",           bio: "تفاصيل صغيرة تُسعدني 💖 • little things",avatarUrl: PRAVATAR(16), personaType: "romantic", staggerIndex: 8 },
    { username: "hala_v",       displayName: "❁ هَلا ❁",            bio: "أحبّ الشعر العتيق 📖 • poetry lover",    avatarUrl: PRAVATAR(20), personaType: "poetry",   staggerIndex: 10 },
    { username: "dina_m",       displayName: "✿ Dina • دينا ✿",     bio: "اللهم اهدنا 🤍 • be kind",               avatarUrl: PRAVATAR(21), personaType: "hadith",   staggerIndex: 12 },
    { username: "raghd_x",      displayName: "★ رَغد ★",            bio: "طموحٌ بلا حدود 🚀 • dream big",          avatarUrl: PRAVATAR(23), personaType: "serious",  staggerIndex: 14 },
    { username: "malak_a",      displayName: "༄ ملاك ༄",            bio: "أحبّ الناس بهدوء 🌹 • quiet love",       avatarUrl: PRAVATAR(24), personaType: "romantic", staggerIndex: 16 },
    { username: "shahd_b",      displayName: "✩ شَهد ✩",            bio: "كلمة جميلة تكفي 🌿 • gentle words",      avatarUrl: PRAVATAR(32), personaType: "poetry",   staggerIndex: 18 },

    // BOYS (10) — decorated, attractive display names
    { username: "yazan_t",      displayName: "⚡ يَزن ⚡",            bio: "بسيطٌ بطبعي 🌿 • simple life",           avatarUrl: PRAVATAR(3),  personaType: "hadith",   staggerIndex: 1 },
    { username: "faris_n",      displayName: "✦ Faris • فارس ✦",    bio: "أعمل بصمت 💪 • work in silence",         avatarUrl: PRAVATAR(7),  personaType: "serious",  staggerIndex: 3 },
    { username: "ammar_d",      displayName: "♛ عَمّار ♛",          bio: "حُبٌّ صادق، لا أكثر ❤️ • honest heart", avatarUrl: PRAVATAR(8),  personaType: "romantic", staggerIndex: 5 },
    { username: "sami_k",       displayName: "✒ سَامي ✒",           bio: "أُحبّ الكلمة الموزونة 📖 • word lover", avatarUrl: PRAVATAR(11), personaType: "poetry",   staggerIndex: 7 },
    { username: "bilal_e",      displayName: "☪ بِلال ☪",           bio: "صلّ على النبي ﷺ • peace within",         avatarUrl: PRAVATAR(12), personaType: "hadith",   staggerIndex: 9 },
    { username: "rakan_y",      displayName: "▲ Rakan • راكان ▲",   bio: "اصنع الفرق 🚀 • make it count",          avatarUrl: PRAVATAR(13), personaType: "serious",  staggerIndex: 11 },
    { username: "jad_p",        displayName: "♥ جاد ♥",             bio: "قلبي بسيط مثلك 💖 • simple heart",       avatarUrl: PRAVATAR(14), personaType: "romantic", staggerIndex: 13 },
    { username: "sufyan_g",     displayName: "✧ سُفيان ✧",          bio: "ولِكلٍّ مما يَهوى رِواية 🌿 • a story", avatarUrl: PRAVATAR(15), personaType: "poetry",   staggerIndex: 15 },
    { username: "ziyad_z",      displayName: "☾ زِياد ☾",           bio: "اللهم يسّر ولا تعسّر 🤲 • trust Him",   avatarUrl: PRAVATAR(17), personaType: "hadith",   staggerIndex: 17 },
    { username: "mazen_o",      displayName: "★ Mazen • مازن ★",    bio: "ركّز على الأهم ✨ • stay focused",       avatarUrl: PRAVATAR(18), personaType: "serious",  staggerIndex: 19 },
  ];

  let createdPersonas = 0;
  const nowMs = Date.now();
  // Varied gaps between posts (in minutes): 30m, 1h, 2h, 3h — distributed so
  // consecutive personas' "next due" times are spaced naturally.
  const gapPool = [30, 60, 120, 180];
  let phaseAcc = 0;
  for (let i = 0; i < defaults.length; i++) {
    const d = defaults[i];
    const email = `ai_${d.username}_${Date.now()}@ai.local`;
    const password = crypto.randomUUID() + crypto.randomUUID();
    const { data: u, error: ue } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { username: d.username },
    });
    if (ue || !u.user) { console.error("seed user err", ue?.message); continue; }
    const uid = u.user.id;
    await supabaseAdmin.from("profiles").update({
      is_ai: true, username: d.username, bio: d.bio, avatar_url: d.avatarUrl, dm_locked: true,
    }).eq("id", uid);
    // Each persona still posts once every 5h, but their phase within the 5h cycle
    // is offset by a random gap from {30m, 1h, 2h, 3h} — so the feed shows posts
    // spaced naturally instead of bursts.
    const gap = gapPool[Math.floor(Math.random() * gapPool.length)];
    phaseAcc = (phaseAcc + gap) % 300; // 0..299 minutes within the 5h cycle
    // Persona will become due in `phaseAcc` minutes from now.
    const lastPostAt = new Date(nowMs - (300 - phaseAcc) * 60_000).toISOString();
    const { error: ie } = await supabaseAdmin.from("ai_personas").insert({
      profile_id: uid, display_name: d.displayName, bio: d.bio, avatar_url: d.avatarUrl,
      persona_type: d.personaType,
      post_interval_minutes: 300, // 5 hours per bot
      reaction_rate: 0.6 + Math.random() * 0.3,
      last_post_at: lastPostAt,
    } as any);
    if (!ie) {
      createdPersonas++;
      const badgeId = BADGE_BY_TYPE[d.personaType];
      if (badgeId) {
        await supabaseAdmin.from("user_badges").insert({ user_id: uid, badge_id: badgeId } as any).then(() => null, () => null);
      }
    }
  }


  // ── Templates: 200 unique comments (50 per type) + 200 unique images for posts/stories
  // Use seeded picsum URLs so every image is unique and deterministic.
  const img = (seed: string) => `https://picsum.photos/seed/${seed}/800/800`;

  const ROMANTIC_POSTS = [
    "في عينيك وطنٌ لا يُغادر، وفي صوتك أمانٌ لا يُوصف ❤️",
    "أحبك حين تكون، وأحبك حين تغيب… أحبك بكل ما في الكلمة من معنى 🌹",
    "قلبي بيتٌ صغير، أنتَ ساكنه الوحيد 💖",
    "كل غروبٍ يذكّرني بك… يا أجمل ما رأت عيناي 🌅",
    "أنتَ القصيدة التي لم تُكتب بعد ✨",
    "تفاصيلك الصغيرة تكفيني عمرًا كاملًا 💕",
    "لو سألوني عن السعادة لأشرتُ إليك 🌸",
    "أحبك بصمتٍ يُسمعه القلب وحده ❤️",
    "في حضورك يتعطّل كل شيء سواك 💖",
    "كأنّ الحبَّ خُلق ليُقال باسمك 🌹",
    "أنتَ النور الذي يسبق الصباح ☀️",
    "بكلمةٍ منك تعود الحياة 💞",
    "اشتقتُ إليك حتى وأنتَ هنا 🥺",
    "قلبي يعرف الطريق إليك دائمًا ❤️",
    "أنتَ تفصيلٌ لا يُكرَّر في عمري 🌹",
    "Some people feel like home the moment you meet them 💖",
    "You're my favorite hello and my hardest goodbye 🌹",
    "Loved you yesterday, love you still, always have, always will ❤️",
    "كل ما حولي يهدأ حين أتذكّرك 🌙 — you are my calm",
    "In a room full of art, I would still stare at you 🎨❤️",
    "أنتَ الفكرة التي تراودني قبل النوم وبعد الاستيقاظ 💭💕",
    "I don't need much. Just you, coffee, and a quiet morning ☕🌸",
    "حين أحببتك… فهمتُ كل الأغاني 🎶❤️",
    "You're the poem I keep rewriting in my head ✍️🌹",
  ];
  const ROMANTIC_STORIES = [
    "أحبك… ببساطة 💕",
    "أنت تفصيلي الجميل 🌹",
    "قلبي يبتسم لك ❤️",
    "حضورك = راحة 💖",
    "كل المساء يشبهك 🌅",
    "اشتقت لك 🥺",
    "ابتسامتك = يومي ☀️",
    "أحبك أكثر 💞",
    "أنت الأجمل دومًا 🌸",
    "بقلبي أنت 💖",
    "you = home 🏡❤️",
    "missing you 🥺💭",
    "my favorite person 🌹",
    "good morning, love ☕💕",
    "stay 💖",
  ];
  const POETRY_POSTS = [
    "ولي وطنٌ آليتُ ألّا أبيعه\nوألّا أرى غيري له الدهرَ مالكا — أحمد شوقي",
    "إذا الشعبُ يومًا أرادَ الحياة\nفلا بدَّ أن يستجيبَ القدر — أبو القاسم الشابي",
    "ما كلُّ ما يتمنى المرءُ يدركُه\nتجري الرياحُ بما لا تشتهي السفنُ — المتنبي",
    "وإذا كانت النفوسُ كبارًا\nتعبت في مرادها الأجسامُ — المتنبي",
    "على قدرِ أهلِ العزمِ تأتي العزائمُ\nوتأتي على قدرِ الكرامِ المكارمُ — المتنبي",
    "إذا غامرتَ في شرفٍ مرومِ\nفلا تقنع بما دون النجومِ — المتنبي",
    "وما نيلُ المطالبِ بالتمنّي\nولكن تُؤخذُ الدنيا غِلابا — أحمد شوقي",
    "ومن يكُ ذا فمٍ مرٍّ مريضٍ\nيجد مُرًّا به الماءَ الزلالا — المتنبي",
    "الخيلُ والليلُ والبيداءُ تعرفني\nوالسيفُ والرمحُ والقرطاسُ والقلمُ — المتنبي",
    "قُم للمعلِّمِ وفّهِ التبجيلا\nكاد المعلِّمُ أن يكون رسولا — أحمد شوقي",
    "تَعَلَّم فليس المرءُ يُولدُ عالِمًا\nوليس أخو علمٍ كمن هو جاهلُ — الشافعي",
    "إذا كنتَ في كلِّ الأمورِ معاتبًا\nصديقك لم تَلقَ الذي لا تُعاتبه — بشار بن برد",
    "“And still, I rise.” — Maya Angelou ✨",
    "“We accept the love we think we deserve.” — Stephen Chbosky 💭",
    "“Stars can't shine without darkness.” 🌌",
    "“The wound is the place where the Light enters you.” — Rumi 🌙",
    "وَأَنتَ بِأَخذِكَ الْأَيّامَ فَخراً\nأَرَدتَ بِأَنْ تُؤَنَّسَكَ النّجوم — verses that never age 📖",
  ];
  const POETRY_STORIES = [
    "الشعر ميزانُ القومِ 📖",
    "بيتٌ يلامس الروح ✨",
    "كلمات لها وزن 🌿",
    "للعربية بهاءٌ آخر 📜",
    "يا جمال اللغة 💫",
    "حرفٌ يحيي القلب ✒️",
    "من عيون الشعر 🌹",
    "بيتٌ خالد ⭐",
    "words > everything 📖✨",
    "poetry hits different at night 🌙",
    "a line worth saving 💫",
  ];
  const HADITH_POSTS = [
    "قال ﷺ: «إنما الأعمالُ بالنياتِ، وإنما لكلِّ امرئٍ ما نوى» — متفقٌ عليه",
    "قال ﷺ: «الكلمةُ الطيبةُ صدقة» — متفقٌ عليه 🌿",
    "قال ﷺ: «من كان يؤمنُ باللهِ واليومِ الآخرِ فليقل خيرًا أو ليصمت»",
    "قال ﷺ: «المسلمُ من سلم المسلمون من لسانه ويده»",
    "قال ﷺ: «لا يؤمنُ أحدُكم حتى يحبَّ لأخيه ما يحبُّ لنفسه»",
    "قال ﷺ: «الدّينُ النصيحة»",
    "قال ﷺ: «من سلك طريقًا يلتمس فيه علمًا سهّل الله له طريقًا إلى الجنة»",
    "قال ﷺ: «إن الله جميلٌ يحب الجمال»",
    "قال ﷺ: «اتقِ الله حيثما كنت، وأتبع السيئةَ الحسنةَ تمحُها»",
    "قال ﷺ: «من لا يَرحم لا يُرحم»",
    "قال ﷺ: «خيركم خيركم لأهله»",
    "قال ﷺ: «إن الله كتب الإحسانَ على كلِّ شيء»",
    "The Prophet ﷺ said: “The best of you are those who are best to their families.” 🤍",
    "“Verily, with hardship comes ease.” — Qur'an 94:6 🌙✨",
    "A kind word is a charity 🌿 — start your day with one.",
    "“Be in this world as if you were a stranger or a traveler.” — Hadith 🕊️",
  ];
  const HADITH_STORIES = [
    "لا تنسَ ذكر الله 🤲",
    "اللهم صلِّ على محمد ﷺ",
    "أستغفر الله العظيم 🤍",
    "سبحان الله وبحمده 🌿",
    "اللهم اغفر لنا 🤲",
    "لا إله إلا الله 💚",
    "اللهم لك الحمد 🌙",
    "حسبنا الله ونعم الوكيل ✨",
    "alhamdulillah for everything 🤍",
    "say SubhanAllah today 🌿",
    "trust His plan 🌙",
  ];
  const SERIOUS_POSTS = [
    "لا تنتظر اللحظة المثالية… اعمل الآن ثم اصنعها مثاليّة.",
    "النجاح ليس صدفة، بل ساعات هادئة من العمل خلف الكواليس.",
    "ركّز على ما تستطيع تغييره، واترك الباقي للوقت.",
    "أهم استثمار في حياتك: نفسك. اقرأ، تعلّم، طوّر مهاراتك.",
    "العادات الصغيرة اليومية أقوى من القرارات الكبيرة المفاجئة.",
    "لا تقارن بدايتك بنهاية غيرك.",
    "الانضباط أقوى من الحماس؛ الحماس يفنى والانضباط يبقى.",
    "اقرأ كتابًا هذا الأسبوع، ولو 10 صفحات يوميًا.",
    "حدّد هدفًا واحدًا واضحًا، ثم اعمل عليه بلا تشتت.",
    "الفشل ليس نهاية الطريق، بل بداية فهم أعمق.",
    "ابتعد عن من يستنزفك، حتى لو كان قريبًا.",
    "صحتك أولًا: نوم جيد، حركة يومية، طعام نظيف.",
    "Discipline > motivation. Always. 💪",
    "Small steps every day beat huge leaps once a month. 🚀",
    "Your future is built in the boring hours nobody sees. 🌱",
    "Protect your peace. Not every battle deserves your energy. 🕊️",
    "Read 10 pages a day. In a year, that's 12+ books. 📚",
    "ابدأ الآن، ولو ناقصًا. Start now, even imperfect. ✨",
  ];
  const SERIOUS_STORIES = [
    "ابدأ اليوم. ولو خطوة واحدة. 🚀",
    "ركّز ✨",
    "اعمل بصمت 💪",
    "ثقتك بنفسك = نصف الطريق ⭐",
    "حدد أولوياتك 🎯",
    "اشرب ماء، نَم باكرًا 🌙",
    "خطوة واحدة كل يوم 🌿",
    "لا تتوقف 🔥",
  ];

  // 50 unique comments per type = 200 total
  const ROMANTIC_COMMENTS = [
    "كلام يلامس القلب ❤️", "أجمل ما قُرئ اليوم 🌹", "💖💖💖", "تفاصيلك جميلة 🌸",
    "وصفٌ يأسر القلب ✨", "رائعة كعادتك 💕", "كلماتك ربيع 🌹", "يا قلبي 🥺",
    "أحببتها 💖", "تستحق التثبيت ❤️", "هذي تكتب بماء الذهب ✨", "وصفٌ صادق 💞",
    "حبٌّ نقي 🌸", "ما أحلى الكلمات الصادقة ❤️", "أجمل ما قرأت اليوم 💖",
    "كلام دافئ 🌷", "💗 من القلب", "تذوّقتها كقهوة الصباح ☕❤️", "تحفة 🌹",
    "أحبك يا قلب 💕", "روعة 🥹", "بقلبي 💞", "تصلح أن تكون أغنية 🎶",
    "وصلتني الرسالة 💖", "كم هذا جميل 🌸", "أنتِ شاعرة 🌹", "ما شاء الله 💕",
    "أحاسيس راقية ✨", "أحببتها كثيرًا ❤️", "كلام عذب 🍃", "💘", "كلمة وحبكة 🌹",
    "هذي تترسخ بالذاكرة ❤️", "كلامك ضوء 💡", "💕✨", "كم أنتَ صادق 💖",
    "احتجت هذي الكلمات 🌷", "أحببت الإحساس 💞", "وصلت 💌", "🌹❤️🌹",
    "أنا معجبة 💖", "بُوركت 🌸", "كلام يرفع المعنويات 💕", "🩷",
    "كم هي صادقة ❤️", "أحببت اختيارك للصورة 🌹", "💝", "تذكّرتُ بها أحدًا 🥺",
    "كلام يستحق ❤️", "بسيط وعميق 💖",
  ];
  const POETRY_COMMENTS = [
    "بيتٌ خالد ✨", "ما أجمل اختيارك 🌿", "📖❤️", "اختيارك راقٍ ⭐",
    "بيت من الذهب ✨", "للأبد يبقى ⭐", "أبدع المتنبي 💫", "اختيارٌ موفّق 📜",
    "ما أعذب لغتنا 🌷", "بيت يهز الوجدان ✒️", "💫📖", "تحفة أدبية ⭐",
    "روعة الشعر 🌟", "اختيار راقٍ جدًا ✨", "بيتٌ سامي 📜", "للعربية بهاء 🌿",
    "كأن البيت كُتب اليوم ⭐", "💖 ما أعذبه", "لله درّ الشاعر ✨", "ربي يحفظ العربية 📖",
    "أبدعت بالاختيار 🌟", "البيت كأنه قطعة ماس 💎", "هذي قصائد لا تموت ⭐",
    "تحفة شعرية ✨", "أحببت البيت كثيرًا 🌹", "حروف من ذهب 📜", "🌟📖",
    "ما أبهى البيان ✨", "بيت كأنه نسيم 🌿", "💎", "للأدب رجالٌ كهؤلاء 📚",
    "🌹📖", "بيتٌ يستحق التأمل 💫", "اختيار ذوق ⭐", "كأن البيت قِيل لي 🥺",
    "اللهم ارحم شاعرنا 🤍", "🌟✨", "بيت من القلب 💖", "ربي يحفظك على الاختيار 🌿",
    "هذي من جواهر الأدب 💎", "اختيارك أصيل ⭐", "📜❤️", "بيتٌ سهلٌ ممتنع 💫",
    "أعدتُ قراءته 🥲", "بيت يعلّمنا الحياة 📖", "اللغة سفينة الأدب 🌊",
    "حروفٌ تنبض ✒️", "بيت لا يضاهى ⭐", "أحببت الإيقاع ✨", "روعة 🌟",
  ];
  const HADITH_COMMENTS = [
    "جزاك الله خيرًا 🤍", "اللهم آمين 🤲", "بارك الله فيك 🌿", "اللهم صلِّ على محمد ﷺ",
    "نسأل الله القبول 🤲", "ربي يكتب أجرك 🤍", "🌙✨", "ذكّرتنا، جزاك الله خيرًا 🌷",
    "اللهم بلّغنا الإحسان 🤲", "ربي يرحم نبيّنا ﷺ", "آمين يا رب 🤍",
    "اللهم اجعلنا من أهل القرآن 🤲", "بارك الله في وقتك 🌿", "ما أعظمها وصية 🌙",
    "نسأل الله الثبات 🤍", "اللهم أنر قلوبنا ✨", "ربي يجزيك خيرًا 🌷",
    "اللهم استرنا في الدنيا والآخرة 🤲", "💚 جزاك الله خيرًا", "اللهم اهدنا 🤍",
    "ربي يوفقك 🌙", "ذكرى نافعة، شكرًا 🌿", "اللهم اجمعنا بحبيبنا ﷺ 🤲",
    "بُورك في كلماتك ✨", "اللهم اشرح صدورنا 🤍", "🤲🤍", "ربي يرفع قدرك 🌷",
    "اللهم رضّنا بقضائك 🤲", "هذا ما نحتاجه يوميًا 🌿", "ربي يبارك في أيامك ✨",
    "اللهم اجعلنا من أهل الجنة 🤲", "ذكّر فإن الذكرى تنفع 🌙", "🤍🤲",
    "اللهم اغفر لنا ولوالدينا 🤲", "ربي يرحم موتانا 🌷", "اللهم لك الحمد ✨",
    "ربي يجعلها في ميزان حسناتك 🤍", "اللهم بلغنا رمضان 🌙", "🤲✨",
    "نسأل الله الإخلاص 🤍", "اللهم اجعلنا من الذاكرين 🌿", "ربي يحفظك 🤲",
    "🤍🌿", "ذكّرتنا بأنفسنا 💚", "اللهم إنا نستودعك ديننا 🤲",
    "بارك الله فيك ونفع بك 🤍", "اللهم اجعلنا مع الصادقين 🌙", "🤲💚",
    "ربي يجعلك سببًا للخير 🌷", "اللهم اجعلنا من الموحدين 🤍",
  ];
  const SERIOUS_COMMENTS = [
    "كلام في الصميم 👌", "أتفق تمامًا 💯", "نصيحة قيمة 🌿", "صحيح جدًا ✅",
    "هذا ما نحتاجه 💡", "💯", "اقتباس ذهبي ⭐", "كلام واقعي 🙌",
    "محتوى نافع، شكرًا 🌟", "أعجبني الطرح 👏", "✨ نصيحة ثمينة", "كلام يفتح آفاق 🌱",
    "أحببت الفكرة 💡", "تحفيز جميل 🔥", "بالضبط 👌", "كلامك سليم 100% 💯",
    "🚀 لنبدأ", "نصيحة من ذهب ⭐", "كم احتجتُ هذا اليوم 💪", "بُوركت ✨",
    "هذي قاعدة حياتية 📌", "محتوى يستحق التثبيت 📍", "بالفعل 💯", "🌿 شكرًا",
    "كلام واعٍ 💡", "أتفق وبشدة ✅", "محتوى راقٍ 🌟", "🙏 جزاك الله خيرًا",
    "نصيحة عملية 👌", "🌱 لنزرع العادة", "كلام يحرّك الهمّة 🔥", "👏👏",
    "📚 مفيد جدًا", "ركيزة مهمة ⚡", "كم هذا حقيقي 💯", "💪 لنبدأ من الآن",
    "حكمة جميلة 🌿", "أحببت الأسلوب ✨", "🎯 مباشر ومفيد", "أحتاج التذكير دائمًا 🙏",
    "كلام يضع النقاط على الحروف ✅", "🌟 شكرًا للنشر", "نصيحة عميقة 💡",
    "💯💯", "محفّز جدًا 🔥", "اقتباس يستحق الحفظ 📌", "🤝 متفق",
    "كم هذا صحيح ⭐", "أنا الآن أعمل بها 🚀", "كلام عملي 100% ✅",
  ];

  const buildTemplates = () => {
    const out: any[] = [];

    // Posts + Stories: each gets a unique seeded image. 50 images per type × 4 = 200 unique images.
    const pushBlock = (type: string, posts: string[], stories: string[]) => {
      // Posts: each post gets up to 4 distinct image variants (using seeded picsum) — total ~50 images.
      const variants = 4;
      posts.forEach((p, i) => {
        for (let v = 0; v < variants; v++) {
          out.push({
            persona_type: type, kind: "post", content: p,
            media_url: img(`${type}-p${i}-${v}`),
            weight: v === 0 ? 3 : 1,
          });
        }
      });
      stories.forEach((s, i) => {
        out.push({
          persona_type: type, kind: "story", content: s,
          media_url: img(`${type}-s${i}`),
          weight: 1,
        });
      });
    };
    pushBlock("romantic", ROMANTIC_POSTS, ROMANTIC_STORIES);
    pushBlock("poetry",   POETRY_POSTS,   POETRY_STORIES);
    pushBlock("hadith",   HADITH_POSTS,   HADITH_STORIES);
    pushBlock("serious",  SERIOUS_POSTS,  SERIOUS_STORIES);

    // Comments: 50 unique per type = 200 unique comments
    const pushComments = (type: string, list: string[]) => {
      list.forEach((c) => out.push({ persona_type: type, kind: "comment", content: c, weight: 1 }));
    };
    pushComments("romantic", ROMANTIC_COMMENTS);
    pushComments("poetry",   POETRY_COMMENTS);
    pushComments("hadith",   HADITH_COMMENTS);
    pushComments("serious",  SERIOUS_COMMENTS);

    return out;
  };

  const templates = buildTemplates();
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

