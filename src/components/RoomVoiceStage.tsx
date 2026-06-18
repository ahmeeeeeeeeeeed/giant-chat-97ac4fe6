// Live voice broadcast stage shown at the top of a room.
//
// - Always visible to room members; collapsed by default when nobody is on
//   stage. Shows speaker avatars with mute/talking indicators.
// - Mods + owner see "اصعد للبث" button → goes live immediately.
// - Regular members see "ارفع اليد" → hand request appears for mods.
// - Pending speaker invites for me trigger an accept/reject inline banner.

import { useEffect, useMemo, useState } from "react";
import { useRoomVoice, type Speaker } from "@/lib/use-room-voice";
import { supabase } from "@/integrations/supabase/client";
import {
  Mic, MicOff, Hand, PhoneOff, UserPlus, X, Crown,
  Radio, Volume2, Users as UsersIcon, Check, Search,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

type Rank = "owner" | "admin" | "moderator" | "member";

type Profile = { username: string | null; avatar_url: string | null };

export function RoomVoiceStage({
  roomId, myUserId, myRank, memberCount,
}: {
  roomId: string;
  myUserId: string | undefined;
  myRank: Rank | null;
  memberCount: number;
}) {
  const v = useRoomVoice(roomId, myUserId);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [expanded, setExpanded] = useState(false);
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const [memberList, setMemberList] = useState<{ user_id: string; rank: string }[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const isMod = myRank === "owner" || myRank === "admin" || myRank === "moderator";

  // Load members for invite picker
  useEffect(() => {
    if (!showInvitePicker) return;
    (async () => {
      const { data } = await supabase.from("room_members").select("user_id, rank").eq("room_id", roomId);
      if (!data) return;
      setMemberList(data as any);
      const missing = data.map((m: any) => m.user_id).filter((u) => !profiles[u]);
      if (missing.length) {
        const { data: prof } = await supabase.from("profiles").select("id, username, avatar_url").in("id", missing);
        if (prof) {
          setProfiles((p) => {
            const next = { ...p };
            for (const row of prof) next[row.id] = { username: row.username, avatar_url: row.avatar_url };
            return next;
          });
        }
      }
    })();
  }, [showInvitePicker, roomId, profiles]);


  // Fetch profile info for everyone shown
  useEffect(() => {
    const uids = new Set<string>();
    for (const s of v.speakers) uids.add(s.user_id);
    for (const r of v.raisedHands) uids.add(r.user_id);
    for (const i of v.allInvites) uids.add(i.user_id);
    const missing = Array.from(uids).filter((u) => !profiles[u]);
    if (!missing.length) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("id, username, avatar_url").in("id", missing);
      if (!data) return;
      setProfiles((p) => {
        const next = { ...p };
        for (const row of data) next[row.id] = { username: row.username, avatar_url: row.avatar_url };
        return next;
      });
    })();
  }, [v.speakers, v.raisedHands, v.allInvites, profiles]);

  const showStage = v.speakers.length > 0 || expanded || !!v.myInvite || v.myHandRaised;
  const listeners = Math.max(0, memberCount - v.speakers.length);

  // Invite banner takes priority
  if (v.myInvite && !v.amSpeaker) {
    return (
      <div className="mx-3 mt-2 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 to-teal-500/15 p-3 animate-in slide-in-from-top-2">
        <div className="flex items-center gap-2 mb-2">
          <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
          <span className="font-bold text-sm">دعوة للصعود إلى البث</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">قبل الصعود سيُفعَّل الميكروفون.</p>
        <div className="flex gap-2">
          <button
            onClick={v.acceptInvite}
            disabled={v.isJoining}
            className="flex-1 h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition"
          >
            <Check className="h-4 w-4" /> قبول والصعود
          </button>
          <button
            onClick={v.rejectInvite}
            className="px-4 h-10 rounded-xl border border-border font-bold text-sm"
          >
            رفض
          </button>
        </div>
      </div>
    );
  }

  if (!showStage) {
    return (
      <div className="mx-3 mt-2 flex items-center justify-between rounded-2xl border border-border bg-card/60 p-2.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Radio className="h-3.5 w-3.5 opacity-60" />
          <span>لا يوجد بث صوتي نشط</span>
        </div>
        {isMod ? (
          <button
            onClick={v.joinStage}
            disabled={v.isJoining}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 active:scale-95"
          >
            <Mic className="h-3.5 w-3.5" /> ابدأ البث
          </button>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium"
          >
            عرض اللوحة
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-3 mt-2 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-teal-500/8 to-cyan-500/10 backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/15">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio className="h-4 w-4 text-emerald-500" />
            {v.speakers.length > 0 && (
              <span className="absolute -top-0.5 -end-0.5 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
          <span className="text-xs font-bold">
            البث المباشر
          </span>
          <span className="text-[10px] text-muted-foreground">
            • {v.speakers.length} متحدث
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Volume2 className="h-3 w-3" /> {listeners}
          </span>
        </div>
        <button onClick={() => setExpanded((x) => !x)} className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
          {expanded ? "إخفاء" : "عرض"}
        </button>
      </div>

      {/* Speakers row */}
      <div className="flex flex-wrap gap-2.5 p-3">
        {v.speakers.length === 0 && (
          <div className="text-xs text-muted-foreground py-2">في انتظار بدء البث...</div>
        )}
        {v.speakers.map((s) => (
          <SpeakerTile
            key={s.id}
            sp={s}
            profile={profiles[s.user_id]}
            isMe={s.user_id === myUserId}
            canManage={isMod && s.user_id !== myUserId}
            onMute={(m) => v.muteSpeaker(s.user_id, m)}
            onRemove={() => v.removeSpeaker(s.user_id)}
          />
        ))}
      </div>

      {/* My controls */}
      <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
        {v.amSpeaker ? (
          <>
            <button
              onClick={v.toggleMute}
              className={`h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                v.localMuted
                  ? "bg-red-500/15 text-red-600 border border-red-500/30"
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
              }`}
            >
              {v.localMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {v.localMuted ? "مكتوم" : "مفتوح"}
            </button>
            <button
              onClick={v.leaveStage}
              className="h-10 px-4 rounded-xl text-xs font-bold bg-red-500/15 text-red-600 border border-red-500/30 flex items-center gap-1.5"
            >
              <PhoneOff className="h-3.5 w-3.5" /> النزول من البث
            </button>
          </>
        ) : isMod ? (
          <button
            onClick={v.joinStage}
            disabled={v.isJoining}
            className="h-10 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex items-center gap-1.5 active:scale-95"
          >
            <Mic className="h-3.5 w-3.5" /> اصعد للبث
          </button>
        ) : v.myHandRaised ? (
          <button
            onClick={v.lowerHand}
            className="h-10 px-4 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-700 border border-amber-500/30 flex items-center gap-1.5"
          >
            <Hand className="h-3.5 w-3.5" /> إنزال اليد
          </button>
        ) : (
          <button
            onClick={v.raiseHand}
            className="h-10 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white flex items-center gap-1.5 active:scale-95"
          >
            <Hand className="h-3.5 w-3.5" /> رفع اليد
          </button>
        )}
      </div>

      {/* Raised hands (mods only) */}
      {isMod && v.raisedHands.length > 0 && (
        <div className="border-t border-emerald-500/15 px-3 py-2.5 bg-amber-500/5">
          <div className="flex items-center gap-1.5 mb-2">
            <Hand className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-bold">أيادٍ مرفوعة ({v.raisedHands.length})</span>
          </div>
          <div className="space-y-1.5">
            {v.raisedHands.map((h) => {
              const p = profiles[h.user_id];
              const invited = v.allInvites.some((i) => i.user_id === h.user_id);
              return (
                <div key={h.id} className="flex items-center gap-2 rounded-xl bg-background/60 p-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={p?.avatar_url ?? undefined} />
                    <AvatarFallback>{(p?.username ?? "?").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium flex-1 truncate">{p?.username ?? "..."}</span>
                  {invited ? (
                    <span className="text-[10px] text-emerald-600 font-bold">تمت الدعوة</span>
                  ) : (
                    <button
                      onClick={() => v.inviteToSpeak(h.user_id)}
                      className="rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-1 text-[10px] font-bold flex items-center gap-1"
                    >
                      <UserPlus className="h-3 w-3" /> دعوة للصعود
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending invites (mods only) */}
      {isMod && v.allInvites.length > 0 && (
        <div className="border-t border-emerald-500/15 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <UserPlus className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[11px] font-bold">دعوات قيد الانتظار ({v.allInvites.length})</span>
          </div>
          <div className="space-y-1.5">
            {v.allInvites.map((i) => {
              const p = profiles[i.user_id];
              return (
                <div key={i.id} className="flex items-center gap-2 rounded-xl bg-background/60 p-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={p?.avatar_url ?? undefined} />
                    <AvatarFallback>{(p?.username ?? "?").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs flex-1 truncate">{p?.username ?? "..."}</span>
                  <button
                    onClick={() => v.revokeInvite(i.user_id)}
                    className="rounded-lg p-1 text-muted-foreground hover:text-red-500"
                    aria-label="إلغاء الدعوة"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SpeakerTile({
  sp, profile, isMe, canManage, onMute, onRemove,
}: {
  sp: Speaker;
  profile?: Profile;
  isMe: boolean;
  canManage: boolean;
  onMute: (m: boolean) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex flex-col items-center gap-1 w-16">
      <button
        onClick={() => canManage && setOpen((o) => !o)}
        className={`relative rounded-full ring-2 transition ${
          sp.is_muted ? "ring-red-500/60" : "ring-emerald-500/60"
        } ${!sp.is_muted ? "animate-pulse-ring" : ""}`}
      >
        <Avatar className="h-12 w-12">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback className="text-sm">{(profile?.username ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className={`absolute -bottom-0.5 -end-0.5 rounded-full p-0.5 ${
          sp.is_muted ? "bg-red-500" : "bg-emerald-500"
        }`}>
          {sp.is_muted ? <MicOff className="h-3 w-3 text-white" /> : <Mic className="h-3 w-3 text-white" />}
        </span>
        {isMe && (
          <span className="absolute -top-1 -start-1 rounded-full bg-amber-400 p-0.5">
            <Crown className="h-2.5 w-2.5 text-amber-900" />
          </span>
        )}
      </button>
      <span className="text-[10px] font-bold truncate max-w-full text-center">
        {profile?.username ?? "..."}
      </span>

      {open && canManage && (
        <div className="absolute top-full mt-1 z-30 w-32 rounded-xl border border-border bg-popover shadow-xl p-1 text-xs">
          <button
            onClick={() => { onMute(!sp.is_muted); setOpen(false); }}
            className="w-full text-start rounded-lg px-2 py-1.5 hover:bg-accent flex items-center gap-1.5"
          >
            {sp.is_muted ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
            {sp.is_muted ? "إلغاء الكتم" : "كتم"}
          </button>
          <button
            onClick={() => { onRemove(); setOpen(false); }}
            className="w-full text-start rounded-lg px-2 py-1.5 hover:bg-accent flex items-center gap-1.5 text-red-500"
          >
            <PhoneOff className="h-3.5 w-3.5" /> إنزال
          </button>
        </div>
      )}
    </div>
  );
}
