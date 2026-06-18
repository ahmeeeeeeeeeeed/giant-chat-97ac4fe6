import { createClient } from "npm:@supabase/supabase-js@2";

const BOT_ID = "9224081f-43d0-4761-b2e2-bfdd4e8e714c";
const BOT_NAME = "giant Administrator";

type RoomPayload = { kind: "room_message"; message_id: string; room_id: string; sender_id: string; content: string };
type DmPayload = { kind: "dm"; message_id: string; sender_id: string; content: string };
type Payload = RoomPayload | DmPayload;

const ADMIN_KEYWORDS = ["احظر", "فك", "اطرد", "اكتم", "افتح", "ارفع", "انزل", "أنزل", "انزّل", "امنح", "اسحب", "رفع", "نزل", "حظر", "طرد", "كتم", "منح", "سحب"];

function jsonText(text: string, status = 200) {
  return new Response(text, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function normalizeArabic(s: string) {
  return s.replace(/[ًٌٍَُِّْـ]/g, "").replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").toLowerCase().trim();
}

function isLikelyAdminCommand(text: string) {
  return ADMIN_KEYWORDS.some((k) => text.includes(k));
}

function extractTargetName(text: string): string | null {
  let t = ` ${text.trim()} `;
  const stripWords = ["احظر", "حظر", "فك حظر", "فك", "اطرد", "طرد", "اكتم", "كتم", "افتح", "ارفع", "رفع", "أنزل", "انزل", "انزّل", "نزل", "امنح", "منح", "اسحب", "سحب", "رتبه", "رتبة", "مشرف", "أونر", "اونر", "مالك", "المالك", "من", "عن", "الى", "إلى", "البوت", "بوت"];
  for (const w of stripWords) t = t.replace(new RegExp(`\\s${w}\\s`, "g"), " ");
  return t.replace(/[@#]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean)[0] ?? null;
}

type AdminAction = "ban" | "unban" | "kick" | "mute" | "unmute" | "promote_admin" | "demote_admin" | "promote_owner" | "grant_mas" | "revoke_mas";

function detectAdminAction(text: string): AdminAction | null {
  const t = normalizeArabic(text);
  if (/فك\s*حظر|الغاء\s*حظر/.test(t)) return "unban";
  if (/احظر|^حظر/.test(t)) return "ban";
  if (/اطرد|طرد/.test(t)) return "kick";
  if (/اكتم|كتم/.test(t)) return "mute";
  if (/افتح|فتح|فك\s*كتم/.test(t)) return "unmute";
  if (/(ارفع|رفع).*مشرف/.test(t)) return "promote_admin";
  if (/(انزل|أنزل|نزل).*مشرف/.test(t)) return "demote_admin";
  if (/(ارفع|رفع).*(اونر|أونر|مالك)/.test(t)) return "promote_owner";
  if (/(امنح|منح).*mas/i.test(text) || /(امنح|منح).*ماس/.test(t)) return "grant_mas";
  if (/(اسحب|سحب).*(mas|ماس)/i.test(`${text} ${t}`)) return "revoke_mas";
  return null;
}

async function aiReply(userText: string, senderName: string): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return "⚠️ خدمة الذكاء الاصطناعي غير متوفرة حالياً.";
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `أنت "${BOT_NAME}" — مساعد ذكي عربي داخل تطبيق دردشة. أجب بإيجاز ووضوح. تستطيع الإجابة والترجمة والحساب والتلخيص. اسم المستخدم: ${senderName}.` },
          { role: "user", content: userText },
        ],
        max_tokens: 600,
      }),
    });
    if (res.status === 429) return "⏱️ كثرة الطلبات — حاول بعد قليل.";
    if (res.status === 402) return "💳 رصيد الذكاء الاصطناعي منتهي.";
    if (!res.ok) {
      console.error("[giant-bot] AI error", res.status, await res.text().catch(() => ""));
      return "⚠️ تعذّر الرد الآن.";
    }
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.trim() || "🤖 لم أجد رداً مناسباً.";
  } catch (e) {
    console.error("[giant-bot] AI exception", e);
    return "⚠️ حدث خطأ أثناء الاتصال.";
  }
}

async function handle(payload: Payload) {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("Missing backend service credentials");
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: sender } = await db.from("profiles").select("id, username").eq("id", payload.sender_id).maybeSingle();
  const senderName = sender?.username ?? "صديقي";

  if (payload.kind === "dm") {
    const reply = await aiReply(payload.content, senderName);
    const { error } = await db.from("direct_messages").insert({ sender_id: BOT_ID, receiver_id: payload.sender_id, content: reply, message_type: "text" });
    if (error) throw error;
    return;
  }

  const replyToRoom = async (text: string) => {
    const { error } = await db.from("room_messages").insert({ room_id: payload.room_id, user_id: BOT_ID, content: text, message_type: "text" });
    if (error) throw error;
  };

  if (!isLikelyAdminCommand(payload.content)) {
    await replyToRoom(await aiReply(payload.content, senderName));
    return;
  }

  const { data: canAdmin } = await db.rpc("has_bot_admin", { _user: payload.sender_id, _room: payload.room_id });
  if (!canAdmin) {
    await replyToRoom(`🚫 ${senderName}، فقط مالك الغرفة أو من يملك صلاحية MAS يمكنه إعطائي أوامر إدارية.`);
    await db.from("bot_logs").insert({ room_id: payload.room_id, actor_id: payload.sender_id, action: "denied", args: { content: payload.content }, success: false, error: "not_authorized" });
    return;
  }

  const action = detectAdminAction(payload.content);
  const targetName = extractTargetName(payload.content);
  if (!action || !targetName) {
    await replyToRoom("🤔 لم أفهم الأمر. اكتب الأمر مع اسم المستخدم بوضوح.");
    return;
  }

  const { data: members } = await db.from("room_members").select("user_id, profiles!inner(id, username)").eq("room_id", payload.room_id);
  const tn = normalizeArabic(targetName);
  const found = ((members ?? []) as Array<{ user_id: string; profiles: { username: string } }>).find((r) => normalizeArabic(r.profiles?.username ?? "").includes(tn));
  let targetId = found?.user_id ?? null;
  let targetUsername = found?.profiles?.username ?? targetName;
  if (!targetId) {
    const { data: g } = await db.from("profiles").select("id, username").ilike("username", `%${targetName}%`).limit(1).maybeSingle();
    if (g) { targetId = g.id; targetUsername = g.username; }
  }
  if (!targetId) { await replyToRoom(`❓ لم أجد مستخدماً باسم "${targetName}".`); return; }
  if (targetId === BOT_ID) { await replyToRoom("🛡️ لا يمكنني تنفيذ هذا الأمر على نفسي."); return; }

  let resultMsg = "";
  let success = true;
  let errMsg: string | null = null;
  try {
    switch (action) {
      case "ban":
        await db.from("room_bans").upsert({ room_id: payload.room_id, user_id: targetId, banned_by: payload.sender_id, reason: "via giant bot" }, { onConflict: "room_id,user_id" });
        await db.from("room_members").delete().eq("room_id", payload.room_id).eq("user_id", targetId);
        resultMsg = `🚫 تم حظر ${targetUsername} من الغرفة.`;
        break;
      case "unban":
        await db.from("room_bans").delete().eq("room_id", payload.room_id).eq("user_id", targetId);
        resultMsg = `✅ تم فك حظر ${targetUsername}.`;
        break;
      case "kick":
        await db.from("room_members").delete().eq("room_id", payload.room_id).eq("user_id", targetId);
        resultMsg = `👋 تم طرد ${targetUsername} من الغرفة.`;
        break;
      case "mute":
        await db.from("room_members").update({ muted: true }).eq("room_id", payload.room_id).eq("user_id", targetId);
        resultMsg = `🔇 تم كتم ${targetUsername}.`;
        break;
      case "unmute":
        await db.from("room_members").update({ muted: false }).eq("room_id", payload.room_id).eq("user_id", targetId);
        resultMsg = `🔊 تم فك كتم ${targetUsername}.`;
        break;
      case "promote_admin":
        await db.from("room_members").upsert({ room_id: payload.room_id, user_id: targetId, rank: "admin" }, { onConflict: "room_id,user_id" });
        resultMsg = `⭐ تم ترقية ${targetUsername} إلى مشرف.`;
        break;
      case "demote_admin":
        await db.from("room_members").update({ rank: "member" }).eq("room_id", payload.room_id).eq("user_id", targetId);
        resultMsg = `↘️ تم تنزيل ${targetUsername} إلى عضو.`;
        break;
      case "promote_owner": {
        const { data: room } = await db.from("rooms").select("owner_id").eq("id", payload.room_id).maybeSingle();
        if (room?.owner_id !== payload.sender_id) { success = false; errMsg = "only owner can transfer ownership"; resultMsg = "🚫 فقط المالك الحالي يمكنه نقل الملكية."; }
        else {
          await db.from("rooms").update({ owner_id: targetId }).eq("id", payload.room_id);
          await db.from("room_members").upsert({ room_id: payload.room_id, user_id: targetId, rank: "owner" }, { onConflict: "room_id,user_id" });
          await db.from("room_members").update({ rank: "admin" }).eq("room_id", payload.room_id).eq("user_id", payload.sender_id);
          resultMsg = `👑 تم نقل ملكية الغرفة إلى ${targetUsername}.`;
        }
        break;
      }
      case "grant_mas":
        await db.from("bot_permissions").upsert({ room_id: payload.room_id, user_id: targetId, granted_by: payload.sender_id }, { onConflict: "room_id,user_id" });
        resultMsg = `🎖️ تم منح ${targetUsername} صلاحية وكيل البوت (MAS).`;
        break;
      case "revoke_mas":
        await db.from("bot_permissions").delete().eq("room_id", payload.room_id).eq("user_id", targetId);
        resultMsg = `❌ تم سحب صلاحية MAS من ${targetUsername}.`;
        break;
    }
  } catch (e) {
    success = false;
    errMsg = e instanceof Error ? e.message : String(e);
    resultMsg = `⚠️ فشل تنفيذ الأمر: ${errMsg}`;
  }

  await replyToRoom(resultMsg);
  await db.from("bot_logs").insert({ room_id: payload.room_id, actor_id: payload.sender_id, target_id: targetId, action, args: { content: payload.content, target_username: targetUsername }, success, error: errMsg });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return jsonText("Method Not Allowed", 405);

  const expected = Deno.env.get("GIANT_BOT_WEBHOOK_SECRET") || "";
  const incoming = req.headers.get("x-bot-secret") || "";
  if (expected && incoming !== expected) return jsonText("Unauthorized", 401);

  let payload: Payload;
  try { payload = await req.json(); } catch { return jsonText("Bad Request", 400); }
  if (!payload || (payload.kind !== "room_message" && payload.kind !== "dm")) return jsonText("Bad Request", 400);

  try {
    await handle(payload);
    return jsonText("ok");
  } catch (e) {
    console.error("[giant-bot] handler error", e);
    return jsonText("Bot handler failed", 500);
  }
});