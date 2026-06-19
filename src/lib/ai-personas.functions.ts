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
  const { data: personas } = await supabaseAdmin
    .from("ai_personas")
    .select("*")
    .eq("is_active", true);
  if (!personas || personas.length === 0) return { processed: 0 };

  let processed = 0;
  for (const p of personas) {
    const lastPost = p.last_post_at ? new Date(p.last_post_at).getTime() : 0;
    const intervalMs = (p.post_interval_minutes || 180) * 60_000;

    // --- 1) Maybe publish a new post or story
    if (now.getTime() - lastPost >= intervalMs) {
      const { data: tpls } = await supabaseAdmin
        .from("ai_persona_templates")
        .select("*")
        .eq("persona_type", p.persona_type)
        .in("kind", ["post", "story"]);
      const tpl = await pickWeighted((tpls || []) as any);
      if (tpl) {
        if (tpl.kind === "post") {
          const { data: post } = await supabaseAdmin
            .from("community_posts")
            .insert({
              author_id: p.profile_id,
              content: tpl.content,
              media_url: tpl.media_url || null,
              media_type: tpl.media_url ? "image" : null,
            } as any)
            .select("id")
            .single();
          await supabaseAdmin.from("ai_persona_activity_log").insert({
            persona_id: p.id,
            action: "post",
            target_id: post?.id || null,
          } as any);
        } else {
          const { data: story } = await supabaseAdmin
            .from("stories")
            .insert({
              user_id: p.profile_id,
              content: tpl.content,
              media_url: tpl.media_url || null,
              media_type: tpl.media_url ? "image" : null,
            } as any)
            .select("id")
            .single();
          await supabaseAdmin.from("ai_persona_activity_log").insert({
            persona_id: p.id,
            action: "story",
            target_id: story?.id || null,
          } as any);
        }
        await supabaseAdmin
          .from("ai_personas")
          .update({ last_post_at: now.toISOString() } as any)
          .eq("id", p.id);
        processed++;
      }
    }

    // --- 2) Maybe react/comment on recent real posts
    if (Math.random() < Number(p.reaction_rate || 0)) {
      const since = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
      const { data: recent } = await supabaseAdmin
        .from("community_posts")
        .select("id, author_id")
        .gte("created_at", since)
        .neq("author_id", p.profile_id)
        .order("created_at", { ascending: false })
        .limit(20);
      const pool = (recent || []).slice(0, 10);
      // up to 3 likes
      const likeTargets = pool.sort(() => Math.random() - 0.5).slice(0, 3);
      for (const t of likeTargets) {
        const { error } = await supabaseAdmin
          .from("community_reactions")
          .upsert({ post_id: t.id, user_id: p.profile_id, reaction: "like" } as any);
        if (!error) {
          await supabaseAdmin.from("ai_persona_activity_log").insert({
            persona_id: p.id,
            action: "like",
            target_id: t.id,
          } as any);
        }
      }
      // up to 1 comment from templates
      const { data: cTpls } = await supabaseAdmin
        .from("ai_persona_templates")
        .select("*")
        .eq("persona_type", p.persona_type)
        .eq("kind", "comment");
      const cTpl = await pickWeighted((cTpls || []) as any);
      if (cTpl && pool.length) {
        const target = pool[Math.floor(Math.random() * pool.length)];
        const { data: comment } = await supabaseAdmin
          .from("community_comments")
          .insert({ post_id: target.id, author_id: p.profile_id, content: cTpl.content } as any)
          .select("id")
          .single();
        await supabaseAdmin.from("ai_persona_activity_log").insert({
          persona_id: p.id,
          action: "comment",
          target_id: comment?.id || null,
        } as any);
      }
      await supabaseAdmin
        .from("ai_personas")
        .update({ last_react_at: now.toISOString() } as any)
        .eq("id", p.id);
    }
  }
  return { processed };
}

export const runPersonaCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    return await runCycleInternal();
  });

export { runCycleInternal as __runCycleInternal };
