// Live audio broadcast inside a room — WebRTC mesh.
//
// Speakers (mods or invited users) capture mic and connect to every other
// participant. Listeners are receive-only — they accept offers from each
// speaker and play the incoming audio. The lower-uid side always creates
// the offer to avoid glare. Signaling rides on `room_voice_signals` via
// Realtime; ICE candidates are dispatched the same way.

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getIceServers } from "@/lib/webrtc/ice-servers";
import { getMediaConstraints, ensureCallPermissions } from "@/lib/webrtc/media";
import { toast } from "sonner";

export type Speaker = {
  id: string;
  room_id: string;
  user_id: string;
  is_muted: boolean;
  is_speaking: boolean;
  added_by: string | null;
  joined_at: string;
};

export type RaisedHand = {
  id: string;
  user_id: string;
  created_at: string;
};

export type SpeakerInvite = {
  id: string;
  user_id: string;
  invited_by: string;
  created_at: string;
};

type PeerEntry = {
  pc: RTCPeerConnection;
  audio?: HTMLAudioElement;
  stream?: MediaStream;
};

export function useRoomVoice(roomId: string, myUserId: string | undefined) {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [raisedHands, setRaisedHands] = useState<RaisedHand[]>([]);
  const [myInvite, setMyInvite] = useState<SpeakerInvite | null>(null);
  const [allInvites, setAllInvites] = useState<SpeakerInvite[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  const [localMuted, setLocalMuted] = useState(false);
  const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const onStageRef = useRef(false);
  const speakersRef = useRef<Speaker[]>([]);

  // --- Voice activity detection ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, { analyser: AnalyserNode; data: Uint8Array; lastSpoke: number }>>(new Map());
  const rafRef = useRef<number | null>(null);
  const speakingRef = useRef<Record<string, boolean>>({});

  const ensureAudioCtx = useCallback(() => {
    if (audioCtxRef.current) return audioCtxRef.current;
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      audioCtxRef.current = new Ctx();
    } catch { /* noop */ }
    return audioCtxRef.current;
  }, []);

  const startVadLoop = useCallback(() => {
    if (rafRef.current != null) return;
    const SPEAK_THRESHOLD = 14; // RMS over 0..128
    const HOLD_MS = 500;
    const tick = () => {
      const now = performance.now();
      const next: Record<string, boolean> = { ...speakingRef.current };
      let changed = false;
      const liveUids = new Set<string>();
      for (const [uid, a] of analysersRef.current) {
        liveUids.add(uid);
        a.analyser.getByteTimeDomainData(a.data as any);
        let sum = 0;
        for (let i = 0; i < a.data.length; i++) {
          const v = a.data[i] - 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / a.data.length);
        if (rms > SPEAK_THRESHOLD) a.lastSpoke = now;
        const speaking = now - a.lastSpoke < HOLD_MS;
        if (!!next[uid] !== speaking) {
          next[uid] = speaking;
          changed = true;
        }
      }
      // prune stale uids
      for (const uid of Object.keys(next)) {
        if (!liveUids.has(uid)) { delete next[uid]; changed = true; }
      }
      if (changed) {
        speakingRef.current = next;
        setSpeakingMap(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const attachAnalyser = useCallback((uid: string, stream: MediaStream) => {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    try {
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      src.connect(analyser);
      analysersRef.current.set(uid, {
        analyser,
        data: new Uint8Array(analyser.fftSize),
        lastSpoke: 0,
      });
      startVadLoop();
    } catch (e) {
      console.warn("[vad] attach failed", e);
    }
  }, [ensureAudioCtx, startVadLoop]);

  const detachAnalyser = useCallback((uid: string) => {
    analysersRef.current.delete(uid);
  }, []);

  const amSpeaker = !!myUserId && speakers.some((s) => s.user_id === myUserId);
  onStageRef.current = amSpeaker;

  // ============== LOAD + SUBSCRIBE ==============
  useEffect(() => {
    if (!roomId || !myUserId) return;
    let alive = true;

    const loadAll = async () => {
      const [sp, rh, inv] = await Promise.all([
        supabase.from("room_speakers").select("*").eq("room_id", roomId).order("joined_at"),
        supabase.from("room_raised_hands").select("*").eq("room_id", roomId).order("created_at"),
        supabase.from("room_speaker_invites").select("*").eq("room_id", roomId),
      ]);
      if (!alive) return;
      if (sp.data) { setSpeakers(sp.data as Speaker[]); speakersRef.current = sp.data as Speaker[]; }
      if (rh.data) setRaisedHands(rh.data as RaisedHand[]);
      if (inv.data) {
        setAllInvites(inv.data as SpeakerInvite[]);
        setMyInvite((inv.data as SpeakerInvite[]).find((i) => i.user_id === myUserId) ?? null);
      }
    };
    loadAll();

    const ch = supabase
      .channel(`room-voice-meta-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_speakers", filter: `room_id=eq.${roomId}` }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_raised_hands", filter: `room_id=eq.${roomId}` }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_speaker_invites", filter: `room_id=eq.${roomId}` }, loadAll)
      .subscribe();

    return () => { alive = false; supabase.removeChannel(ch); };
  }, [roomId, myUserId]);

  // ============== PEER MANAGEMENT ==============
  const createPeer = useCallback((remoteUid: string, initiator: boolean): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });

    pc.onicecandidate = async (ev) => {
      if (!ev.candidate || !myUserId) return;
      await supabase.from("room_voice_signals").insert({
        room_id: roomId, from_user: myUserId, to_user: remoteUid,
        signal_type: "ice", payload: ev.candidate.toJSON() as any,
      });
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0];
      const entry = peersRef.current.get(remoteUid);
      if (!entry) return;
      entry.stream = stream;
      let a = entry.audio;
      if (!a) {
        a = document.createElement("audio");
        a.autoplay = true;
        a.setAttribute("playsinline", "true");
        a.setAttribute("autoplay", "true");
        document.body.appendChild(a);
        entry.audio = a;
      }
      (a as any).srcObject = stream;
      a.muted = false;
      a.volume = 1.0;
      const tryPlay = () => a!.play().catch(() => {
        // Autoplay blocked — unlock on next user gesture
        const unlock = () => {
          a!.play().catch(() => {});
          window.removeEventListener("touchstart", unlock);
          window.removeEventListener("click", unlock);
        };
        window.addEventListener("touchstart", unlock, { once: true });
        window.addEventListener("click", unlock, { once: true });
      });
      tryPlay();
      // Attach VAD for this remote speaker
      attachAnalyser(remoteUid, stream);
    };


    // attach local tracks if we have them (we're a speaker)
    if (localStreamRef.current) {
      for (const t of localStreamRef.current.getTracks()) {
        pc.addTrack(t, localStreamRef.current);
      }
    }

    peersRef.current.set(remoteUid, { pc });

    if (initiator) {
      (async () => {
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        await supabase.from("room_voice_signals").insert({
          room_id: roomId, from_user: myUserId!, to_user: remoteUid,
          signal_type: "offer", payload: { sdp: offer.sdp, type: offer.type } as any,
        });
      })();
    }

    return pc;
  }, [roomId, myUserId]);

  const closePeer = useCallback((remoteUid: string) => {
    const entry = peersRef.current.get(remoteUid);
    if (!entry) return;
    try { entry.pc.close(); } catch { /* noop */ }
    if (entry.audio) { try { entry.audio.remove(); } catch { /* noop */ } }
    peersRef.current.delete(remoteUid);
    detachAnalyser(remoteUid);
  }, [detachAnalyser]);

  // ============== SIGNALING LISTENER ==============
  useEffect(() => {
    if (!roomId || !myUserId) return;

    const handleSignal = async (row: any) => {
      const fromUid = row.from_user as string;
      const type = row.signal_type as "offer" | "answer" | "ice" | "leave";
      const payload = row.payload;

      // Delete the consumed signal so the table stays small
      supabase.from("room_voice_signals").delete().eq("id", row.id).then(() => {});

      if (type === "leave") { closePeer(fromUid); return; }

      let entry = peersRef.current.get(fromUid);
      if (!entry && type === "offer") {
        createPeer(fromUid, false);
        entry = peersRef.current.get(fromUid);
      }
      if (!entry) return;

      try {
        if (type === "offer") {
          await entry.pc.setRemoteDescription({ type: "offer", sdp: payload.sdp });
          const answer = await entry.pc.createAnswer();
          await entry.pc.setLocalDescription(answer);
          await supabase.from("room_voice_signals").insert({
            room_id: roomId, from_user: myUserId, to_user: fromUid,
            signal_type: "answer", payload: { sdp: answer.sdp, type: answer.type } as any,
          });
        } else if (type === "answer") {
          await entry.pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
        } else if (type === "ice") {
          await entry.pc.addIceCandidate(payload);
        }
      } catch (e) {
        console.warn("[room-voice] signal error", e);
      }
    };

    // Drain any queued signals from before subscribe
    (async () => {
      const { data } = await supabase
        .from("room_voice_signals").select("*")
        .eq("room_id", roomId).eq("to_user", myUserId).order("created_at");
      for (const row of data ?? []) await handleSignal(row);
    })();

    const ch = supabase
      .channel(`room-voice-signals-${roomId}-${myUserId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "room_voice_signals",
        filter: `to_user=eq.${myUserId}`,
      }, (payload) => { handleSignal(payload.new as any); })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [roomId, myUserId, createPeer, closePeer]);

  // ============== MESH BOOTSTRAP ==============
  // When the speakers list changes, ensure peer connections to every other
  // participant exist (if we're a speaker) or to every speaker (if listener).
  useEffect(() => {
    if (!roomId || !myUserId) return;
    const present = new Set(speakers.map((s) => s.user_id));

    // Tear down peers that left the stage AND aren't us
    for (const uid of Array.from(peersRef.current.keys())) {
      if (!present.has(uid)) closePeer(uid);
    }

    // Listeners connect to every speaker; speakers connect to every other speaker.
    const targets = speakers.map((s) => s.user_id).filter((uid) => uid !== myUserId);
    for (const uid of targets) {
      if (peersRef.current.has(uid)) continue;
      // To avoid glare: speakers initiate to listeners always; between two
      // speakers, the lower uid initiates.
      const iAmSpeaker = onStageRef.current;
      const initiator = iAmSpeaker && (!present.has(myUserId) || myUserId < uid);
      // (if I'm a listener we wait for the speaker's offer, so initiator=false)
      const shouldInitiate = iAmSpeaker ? initiator : false;
      createPeer(uid, shouldInitiate);
    }
  }, [speakers, roomId, myUserId, createPeer, closePeer]);

  // ============== ACTIONS ==============
  const startMic = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const ok = await ensureCallPermissions(false);
    if (!ok) throw new Error("mic permission denied");
    const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(false));
    localStreamRef.current = stream;
    // Add tracks to existing peers
    for (const [, entry] of peersRef.current) {
      for (const t of stream.getTracks()) entry.pc.addTrack(t, stream);
    }
    // Attach VAD for my own mic so my tile lights up too
    if (myUserId) attachAnalyser(myUserId, stream);
    return stream;
  }, [myUserId, attachAnalyser]);

  const stopMic = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    for (const t of s.getTracks()) { try { t.stop(); } catch { /* noop */ } }
    localStreamRef.current = null;
    if (myUserId) detachAnalyser(myUserId);
  }, [myUserId, detachAnalyser]);

  const joinStage = useCallback(async () => {
    if (!myUserId || isJoining) return;
    setIsJoining(true);
    try {
      await startMic();
      const { error } = await supabase.from("room_speakers").insert({
        room_id: roomId, user_id: myUserId, is_muted: false, added_by: myUserId,
      });
      if (error) {
        stopMic();
        toast.error("لا يمكنك الصعود للبث الآن");
        return;
      }
      // Drop my invite if any
      await supabase.from("room_speaker_invites").delete().eq("room_id", roomId).eq("user_id", myUserId);
      // Drop my raised hand
      await supabase.from("room_raised_hands").delete().eq("room_id", roomId).eq("user_id", myUserId);
    } finally {
      setIsJoining(false);
    }
  }, [roomId, myUserId, isJoining, startMic, stopMic]);

  const leaveStage = useCallback(async () => {
    if (!myUserId) return;
    // Tear down local peers + mic immediately
    const others = Array.from(peersRef.current.keys());
    for (const uid of others) {
      try {
        await supabase.from("room_voice_signals").insert({
          room_id: roomId, from_user: myUserId, to_user: uid,
          signal_type: "leave", payload: {} as any,
        });
      } catch { /* noop */ }
      closePeer(uid);
    }
    stopMic();
    onStageRef.current = false;
    // Optimistic UI
    setSpeakers((prev) => prev.filter((s) => s.user_id !== myUserId));
    const { error } = await supabase.from("room_speakers").delete()
      .eq("room_id", roomId).eq("user_id", myUserId);
    if (error) toast.error("تعذّر النزول من البث");
  }, [roomId, myUserId, stopMic, closePeer]);


  const toggleMute = useCallback(async () => {
    if (!myUserId) return;
    const next = !localMuted;
    setLocalMuted(next);
    const s = localStreamRef.current;
    if (s) for (const t of s.getAudioTracks()) t.enabled = !next;
    await supabase.from("room_speakers").update({ is_muted: next })
      .eq("room_id", roomId).eq("user_id", myUserId);
  }, [roomId, myUserId, localMuted]);

  const raiseHand = useCallback(async () => {
    if (!myUserId) return;
    const { error } = await supabase.from("room_raised_hands").insert({
      room_id: roomId, user_id: myUserId,
    });
    if (error && !error.message.includes("duplicate")) toast.error("تعذّر رفع اليد");
    else toast.success("تم رفع اليد — في انتظار الموافقة");
  }, [roomId, myUserId]);

  const lowerHand = useCallback(async () => {
    if (!myUserId) return;
    await supabase.from("room_raised_hands").delete()
      .eq("room_id", roomId).eq("user_id", myUserId);
  }, [roomId, myUserId]);

  const inviteToSpeak = useCallback(async (uid: string) => {
    if (!myUserId) return;
    const { error } = await supabase.from("room_speaker_invites").insert({
      room_id: roomId, user_id: uid, invited_by: myUserId,
    });
    if (error) toast.error("تعذّر إرسال الدعوة");
    else toast.success("تم إرسال دعوة الصعود");
  }, [roomId, myUserId]);

  const revokeInvite = useCallback(async (uid: string) => {
    await supabase.from("room_speaker_invites").delete()
      .eq("room_id", roomId).eq("user_id", uid);
  }, [roomId]);

  const muteSpeaker = useCallback(async (uid: string, muted: boolean) => {
    const { error } = await supabase.from("room_speakers").update({ is_muted: muted })
      .eq("room_id", roomId).eq("user_id", uid);
    if (error) toast.error("ليس لديك صلاحية");
    else toast.success(muted ? "تم كتم المتحدث" : "تم فتح الميكروفون");
  }, [roomId]);

  const removeSpeaker = useCallback(async (uid: string) => {
    const { error } = await supabase.from("room_speakers").delete()
      .eq("room_id", roomId).eq("user_id", uid);
    if (error) toast.error("ليس لديك صلاحية");
    else toast.success("تم إنزال المتحدث");
  }, [roomId]);

  const acceptInvite = useCallback(async () => {
    await joinStage();
  }, [joinStage]);

  const rejectInvite = useCallback(async () => {
    if (!myUserId) return;
    await supabase.from("room_speaker_invites").delete()
      .eq("room_id", roomId).eq("user_id", myUserId);
  }, [roomId, myUserId]);

  // Cleanup on unmount: DO NOT auto-leave the stage when navigating inside
  // the app. We only tear down local peer connections / mic so resources are
  // released; the user's row in `room_speakers` stays so they remain on stage
  // and are restored when they return to the room screen. Explicit exit is
  // handled by `leaveStage`, sign-out, app exit, or going offline.
  useEffect(() => {
    return () => {
      for (const [uid] of peersRef.current) closePeer(uid);
      const s = localStreamRef.current;
      if (s) { for (const t of s.getTracks()) try { t.stop(); } catch { /* noop */ } }
      localStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myHandRaised = !!myUserId && raisedHands.some((r) => r.user_id === myUserId);

  return {
    speakers, raisedHands, allInvites, myInvite, myHandRaised,
    amSpeaker, localMuted, isJoining,
    joinStage, leaveStage, toggleMute,
    raiseHand, lowerHand,
    inviteToSpeak, revokeInvite, muteSpeaker, removeSpeaker,
    acceptInvite, rejectInvite,
  };
}
