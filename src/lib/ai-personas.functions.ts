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
      const intervalMs = (p.post_interval_minutes || 300) * 60_000;
      const dueToPost = now.getTime() - lastPost >= intervalMs;
      console.log(`[ai-personas] ${p.display_name} due=${dueToPost} lastPost=${p.last_post_at || "never"}`);

      if (!dueToPost) continue;

      // 1) POST
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

      // 2) STORY
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

      // 3) LIKES + 4) COMMENT
      const since = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
      const { data: recent } = await supabaseAdmin
        .from("community_posts").select("id, author_id")
        .gte("created_at", since).neq("author_id", p.profile_id)
        .order("created_at", { ascending: false }).limit(20);
      const pool = (recent || []);
      const likeTargets = [...pool].sort(() => Math.random() - 0.5).slice(0, 2);
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
        .from("ai_persona_templates").select("*")
        .eq("persona_type", p.persona_type).eq("kind", "comment");
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

      await supabaseAdmin.from("ai_personas")
        .update({ last_post_at: now.toISOString(), last_react_at: now.toISOString() } as any)
        .eq("id", p.id);
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

  // 20 personas: 10 girls + 10 boys, distributed across 4 types (romantic/poetry/hadith/serious).
  // Each posts every 5 hours (300 min). Staggered start: last_post_at = now - (300 - i*15) min,
  // so persona i becomes due in i*15 minutes → spread evenly across the 5-hour window.
  const PRAVATAR = (id: number) => `https://i.pravatar.cc/300?img=${id}`;
  const girls = [1, 5, 9, 10, 16, 20, 21, 23, 24, 32];
  const boys  = [3, 7, 8, 11, 12, 13, 14, 15, 17, 18];
  const types = ["romantic", "poetry", "hadith", "serious"] as const;

  const girlNames = ["نورا", "سارة", "لانا", "رنا", "هدى", "ريم", "مريم", "ليلى", "دانا", "جنى"];
  const boyNames  = ["عمر", "علي", "أحمد", "محمد", "يوسف", "خالد", "كريم", "زياد", "حسن", "طارق"];

  const defaults: any[] = [];
  for (let i = 0; i < 10; i++) {
    defaults.push({
      username: `girl_${i + 1}_ai`,
      displayName: girlNames[i],
      bio: ["قلب حالم 💖", "كلمات وأحاسيس", "بين السطور", "نور وأمل", "أنثى بطبعها 🌸",
            "روح شاعرة", "هدوء يسبق الكلام", "تفاؤل دائم ☀️", "حُب وحياة", "ابتسامة الصباح"][i],
      avatarUrl: PRAVATAR(girls[i]),
      personaType: types[i % 4],
      postIntervalMinutes: 300,
      reactionRate: 0.7,
      staggerIndex: i * 2, // 0,2,4,...18
    });
  }
  for (let i = 0; i < 10; i++) {
    defaults.push({
      username: `boy_${i + 1}_ai`,
      displayName: boyNames[i],
      bio: ["كلمة حق 🌿", "رجل بكلمته", "بين الجد والمزاح", "أحب الهدوء", "طموح بلا حدود",
            "قارئ ومفكر 📖", "محب للخير", "صديق وفي", "بسيط وصادق", "متفائل دائمًا"][i],
      avatarUrl: PRAVATAR(boys[i]),
      personaType: types[i % 4],
      postIntervalMinutes: 300,
      reactionRate: 0.7,
      staggerIndex: i * 2 + 1, // 1,3,5,...19
    });
  }

  let createdPersonas = 0;
  const nowMs = Date.now();
  for (const d of defaults) {
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
    // Staggered last_post_at so first cycle picks up personas at different times
    const staggerMs = (300 - d.staggerIndex * 15) * 60_000; // shift each by 15 min
    const lastPostAt = new Date(nowMs - staggerMs).toISOString();
    const { error: ie } = await supabaseAdmin.from("ai_personas").insert({
      profile_id: uid, display_name: d.displayName, bio: d.bio, avatar_url: d.avatarUrl,
      persona_type: d.personaType,
      post_interval_minutes: d.postIntervalMinutes, reaction_rate: d.reactionRate,
      last_post_at: lastPostAt,
    } as any);
    if (!ie) createdPersonas++;
  }

  // ── Templates: romantic / poetry / hadith / serious — posts (with images), stories, comments
  const IMG = {
    rose:    "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=800&q=80",
    sunset:  "https://images.unsplash.com/photo-1495567720989-cebdbdd97913?w=800&q=80",
    couple:  "https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?w=800&q=80",
    heart:   "https://images.unsplash.com/photo-1518895312237-a9e23508077d?w=800&q=80",
    book:    "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80",
    desert:  "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=800&q=80",
    pen:     "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80",
    mosque1: "https://images.unsplash.com/photo-1542816417-0983c9c9ad53?w=800&q=80",
    mosque2: "https://images.unsplash.com/photo-1564769662533-4f00a87b4056?w=800&q=80",
    quran:   "https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=800&q=80",
    light:   "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800&q=80",
    road:    "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80",
    mountain:"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
  };

  const templates: any[] = [
    // ── ROMANTIC posts
    { persona_type: "romantic", kind: "post", content: "في عينيك وطنٌ لا يُغادر، وفي صوتك أمانٌ لا يُوصف ❤️", media_url: IMG.rose, weight: 3 },
    { persona_type: "romantic", kind: "post", content: "أحبك حين تكون، وأحبك حين تغيب… أحبك بكل ما في الكلمة من معنى 🌹", media_url: IMG.couple, weight: 3 },
    { persona_type: "romantic", kind: "post", content: "قلبي بيتٌ صغير، أنتَ ساكنه الوحيد 💖", media_url: IMG.heart, weight: 2 },
    { persona_type: "romantic", kind: "post", content: "كل غروبٍ يذكّرني بك… يا أجمل ما رأت عيناي 🌅", media_url: IMG.sunset, weight: 2 },
    { persona_type: "romantic", kind: "story", content: "أحبك… ببساطة 💕", media_url: IMG.rose, weight: 2 },
    { persona_type: "romantic", kind: "story", content: "أنت تفصيلي الجميل 🌹", media_url: IMG.heart, weight: 1 },
    { persona_type: "romantic", kind: "comment", content: "كلام يلامس القلب ❤️", weight: 2 },
    { persona_type: "romantic", kind: "comment", content: "أجمل ما قُرئ اليوم 🌹", weight: 2 },
    { persona_type: "romantic", kind: "comment", content: "💖💖💖", weight: 1 },

    // ── POETRY posts
    { persona_type: "poetry", kind: "post", content: "ولي وطنٌ آليتُ ألّا أبيعه\nوألّا أرى غيري له الدهرَ مالكا — أحمد شوقي", media_url: IMG.book, weight: 2 },
    { persona_type: "poetry", kind: "post", content: "إذا الشعبُ يومًا أرادَ الحياة\nفلا بدَّ أن يستجيبَ القدر — أبو القاسم الشابي", media_url: IMG.desert, weight: 2 },
    { persona_type: "poetry", kind: "post", content: "ما كلُّ ما يتمنى المرءُ يدركُه\nتجري الرياحُ بما لا تشتهي السفنُ — المتنبي", media_url: IMG.pen, weight: 2 },
    { persona_type: "poetry", kind: "post", content: "وإذا كانت النفوسُ كبارًا\nتعبت في مرادها الأجسامُ — المتنبي", media_url: IMG.mountain, weight: 2 },
    { persona_type: "poetry", kind: "story", content: "الشعر ميزانُ القومِ 📖", media_url: IMG.book, weight: 1 },
    { persona_type: "poetry", kind: "comment", content: "بيتٌ خالد ✨", weight: 2 },
    { persona_type: "poetry", kind: "comment", content: "ما أجمل اختيارك 🌿", weight: 2 },
    { persona_type: "poetry", kind: "comment", content: "📖❤️", weight: 1 },

    // ── HADITH posts
    { persona_type: "hadith", kind: "post", content: "قال ﷺ: «إنما الأعمالُ بالنياتِ، وإنما لكلِّ امرئٍ ما نوى» — متفقٌ عليه", media_url: IMG.mosque1, weight: 3 },
    { persona_type: "hadith", kind: "post", content: "قال ﷺ: «الكلمةُ الطيبةُ صدقة» — متفقٌ عليه 🌿", media_url: IMG.mosque2, weight: 2 },
    { persona_type: "hadith", kind: "post", content: "قال ﷺ: «من كان يؤمنُ باللهِ واليومِ الآخرِ فليقل خيرًا أو ليصمت»", media_url: IMG.quran, weight: 2 },
    { persona_type: "hadith", kind: "post", content: "قال ﷺ: «المسلمُ من سلم المسلمون من لسانه ويده»", media_url: IMG.mosque1, weight: 2 },
    { persona_type: "hadith", kind: "story", content: "لا تنسَ ذكر الله 🤲", media_url: IMG.quran, weight: 2 },
    { persona_type: "hadith", kind: "story", content: "اللهم صلِّ على محمد ﷺ", media_url: IMG.mosque2, weight: 1 },
    { persona_type: "hadith", kind: "comment", content: "جزاك الله خيرًا 🤍", weight: 2 },
    { persona_type: "hadith", kind: "comment", content: "اللهم آمين 🤲", weight: 2 },
    { persona_type: "hadith", kind: "comment", content: "بارك الله فيك 🌿", weight: 1 },

    // ── SERIOUS posts
    { persona_type: "serious", kind: "post", content: "لا تنتظر اللحظة المثالية… اعمل الآن ثم اصنعها مثاليّة.", media_url: IMG.road, weight: 3 },
    { persona_type: "serious", kind: "post", content: "النجاح ليس صدفة، بل ساعات هادئة من العمل خلف الكواليس.", media_url: IMG.light, weight: 2 },
    { persona_type: "serious", kind: "post", content: "ركّز على ما تستطيع تغييره، واترك الباقي للوقت.", media_url: IMG.mountain, weight: 2 },
    { persona_type: "serious", kind: "post", content: "أهم استثمار في حياتك: نفسك. اقرأ، تعلّم، طوّر مهاراتك.", media_url: IMG.book, weight: 2 },
    { persona_type: "serious", kind: "story", content: "ابدأ اليوم. ولو خطوة واحدة. 🚀", media_url: IMG.road, weight: 2 },
    { persona_type: "serious", kind: "comment", content: "كلام في الصميم 👌", weight: 2 },
    { persona_type: "serious", kind: "comment", content: "أتفق تمامًا 💯", weight: 2 },
    { persona_type: "serious", kind: "comment", content: "نصيحة قيمة 🌿", weight: 1 },
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

