import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getIceServers } from "@/lib/webrtc/ice-servers";
import { getMediaConstraints, ensureCallPermissions } from "@/lib/webrtc/media";
import { playRingtone, playDialTone } from "@/lib/webrtc/ringtones";
import { toast } from "sonner";

export type CallType = "audio" | "video";
export type CallStatus =
  | "idle"
  | "outgoing"      // we initiated, waiting for ringing
  | "ringing-out"   // peer is ringing
  | "ringing-in"    // we are being called
  | "connecting"    // negotiating
  | "connected"
  | "ended";

export type PeerProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
};

type State = {
  status: CallStatus;
  callId: string | null;
  callType: CallType;
  peer: PeerProfile | null;
  isCaller: boolean;
  startedAt: number | null;
  connectedAt: number | null;
  muted: boolean;
  cameraOff: boolean;
  speakerOn: boolean;
  facing: "user" | "environment";
  endReason: string | null;
};

type Api = State & {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (peer: PeerProfile, type: CallType) => Promise<void>;
  accept: () => Promise<void>;
  reject: () => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
  switchCamera: () => Promise<void>;
};

const Ctx = createContext<Api | null>(null);

export function useCalls(): Api {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCalls must be used within CallProvider");
  return v;
}

const INITIAL: State = {
  status: "idle",
  callId: null,
  callType: "audio",
  peer: null,
  isCaller: false,
  startedAt: null,
  connectedAt: null,
  muted: false,
  cameraOff: false,
  speakerOn: false,
  facing: "user",
  endReason: null,
};

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<State>(INITIAL);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callIdRef = useRef<string | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const isCallerRef = useRef<boolean>(false);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const stopRingRef = useRef<(() => void) | null>(null);
  const stopDialRef = useRef<(() => void) | null>(null);
  const signalChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const remoteSetRef = useRef(false);
  const statusRef = useRef<CallStatus>("idle");
  useEffect(() => { statusRef.current = state.status; }, [state.status]);

  const stopRing = () => { stopRingRef.current?.(); stopRingRef.current = null; };
  const stopDial = () => { stopDialRef.current?.(); stopDialRef.current = null; };

  const cleanup = useCallback(() => {
    stopRing(); stopDial();
    try { pcRef.current?.close(); } catch { /* noop */ }
    pcRef.current = null;
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    callIdRef.current = null;
    peerIdRef.current = null;
    isCallerRef.current = false;
    pendingIceRef.current = [];
    remoteSetRef.current = false;
  }, [localStream]);

  const sendSignal = useCallback(
    async (signal_type: string, payload: unknown = null) => {
      if (!user || !callIdRef.current || !peerIdRef.current) return;
      await supabase.from("call_signals").insert({
        call_id: callIdRef.current,
        from_user: user.id,
        to_user: peerIdRef.current,
        signal_type,
        payload: (payload ?? null) as never,
      });
    },
    [user]
  );

  const updateCallRow = useCallback(async (patch: Record<string, unknown>) => {
    if (!callIdRef.current) return;
    await supabase.from("calls").update(patch as never).eq("id", callIdRef.current);
  }, []);

  const endCall = useCallback(
    async (reason: "hangup" | "rejected" | "missed" | "failed" | "canceled", sendHangup = true) => {
      const id = callIdRef.current;
      const startedAt = state.startedAt;
      const connectedAt = state.connectedAt;
      if (sendHangup) { try { await sendSignal("hangup", { reason }); } catch { /* noop */ } }
      const duration = connectedAt ? Math.max(0, Math.round((Date.now() - connectedAt) / 1000)) : 0;
      if (id) {
        const status =
          reason === "rejected" ? "rejected" :
          reason === "missed" ? "missed" :
          reason === "failed" ? "failed" :
          reason === "canceled" ? "canceled" : "ended";
        await updateCallRow({
          status,
          end_reason: reason,
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
        }).catch(() => {});
      }
      setState((s) => ({ ...s, status: "ended", endReason: reason }));
      cleanup();
      // After a short delay, reset
      setTimeout(() => setState(INITIAL), 1200);
    },
    [sendSignal, updateCallRow, cleanup, state.startedAt, state.connectedAt]
  );

  // Build PeerConnection
  const buildPc = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    pc.onicecandidate = (e) => {
      if (e.candidate) { sendSignal("ice", e.candidate.toJSON()).catch(() => {}); }
    };
    pc.ontrack = (e) => {
      const remote = e.streams[0] ?? new MediaStream([e.track]);
      setRemoteStream(remote);
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === "connected") {
        setState((s) => s.connectedAt ? s : { ...s, status: "connected", connectedAt: Date.now() });
        stopRing(); stopDial();
      } else if (st === "failed") {
        // Try ICE restart once for transient drops.
        if (isCallerRef.current) {
          pc.restartIce();
        }
      } else if (st === "disconnected") {
        // brief grace; will reconnect or move to failed
      } else if (st === "closed") {
        // handled by cleanup
      }
    };
    return pc;
  }, [sendSignal]);

  // --- Caller flow ---
  const startCall = useCallback(async (peer: PeerProfile, type: CallType) => {
    if (!user) { toast.error("سجّل دخولك أولاً"); return; }
    if (state.status !== "idle" && state.status !== "ended") {
      toast.error("هناك مكالمة جارية"); return;
    }
    const ok = await ensureCallPermissions(type === "video");
    if (!ok) { toast.error("نحتاج إذن الميكروفون" + (type === "video" ? " والكاميرا" : "")); return; }

    // 1) Create call row
    const { data: row, error } = await supabase
      .from("calls")
      .insert({ caller_id: user.id, callee_id: peer.id, call_type: type, status: "ringing" })
      .select()
      .single();
    if (error || !row) { toast.error("تعذّر بدء المكالمة"); return; }

    callIdRef.current = row.id;
    peerIdRef.current = peer.id;
    isCallerRef.current = true;

    setState({
      ...INITIAL,
      status: "outgoing",
      callId: row.id,
      callType: type,
      peer,
      isCaller: true,
      startedAt: Date.now(),
    });

    // 2) Get media
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(type === "video"));
    } catch {
      toast.error("تعذّر الوصول للميكروفون/الكاميرا");
      await endCall("failed");
      return;
    }
    setLocalStream(stream);

    // 3) PC + tracks + offer
    const pc = buildPc();
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: type === "video" });
    await pc.setLocalDescription(offer);
    await sendSignal("offer", { sdp: offer.sdp, type: offer.type });

    // 4) Dial tone + ringing-out state when peer ACKs
    stopDial();
    stopDialRef.current = playDialTone();

    // 5) Auto-cancel after 45s if not answered
    setTimeout(() => {
      if (callIdRef.current === row.id && !remoteSetRef.current) {
        endCall("missed").catch(() => {});
      }
    }, 45000);
  }, [user, state.status, buildPc, sendSignal, endCall]);

  // --- Callee flow (accept / reject) ---
  const accept = useCallback(async () => {
    if (state.status !== "ringing-in") return;
    const ok = await ensureCallPermissions(state.callType === "video");
    if (!ok) { toast.error("نحتاج إذن الميكروفون" + (state.callType === "video" ? " والكاميرا" : "")); return; }
    stopRing();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(state.callType === "video"));
    } catch {
      toast.error("تعذّر الوصول للميكروفون/الكاميرا");
      await endCall("failed");
      return;
    }
    setLocalStream(stream);
    setState((s) => ({ ...s, status: "connecting" }));

    const pc = pcRef.current;
    if (!pc) { await endCall("failed"); return; }
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    await sendSignal("accept");
    await updateCallRow({ status: "accepted", answered_at: new Date().toISOString() });

    // Drain pending ICE
    for (const c of pendingIceRef.current) {
      try { await pc.addIceCandidate(c); } catch { /* noop */ }
    }
    pendingIceRef.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await sendSignal("answer", { sdp: answer.sdp, type: answer.type });
  }, [state.status, state.callType, sendSignal, updateCallRow, endCall]);

  const reject = useCallback(async () => {
    if (state.status !== "ringing-in") return;
    stopRing();
    await sendSignal("reject").catch(() => {});
    await endCall("rejected", false);
  }, [state.status, sendSignal, endCall]);

  const hangup = useCallback(async () => {
    if (state.status === "idle" || state.status === "ended") return;
    const wasConnected = state.status === "connected" || state.status === "connecting";
    await endCall(wasConnected ? "hangup" : (state.isCaller ? "canceled" : "rejected"));
  }, [state.status, state.isCaller, endCall]);

  // --- Track controls ---
  const toggleMute = useCallback(() => {
    if (!localStream) return;
    const newMuted = !state.muted;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !newMuted));
    setState((s) => ({ ...s, muted: newMuted }));
  }, [localStream, state.muted]);

  const toggleCamera = useCallback(() => {
    if (!localStream) return;
    const newOff = !state.cameraOff;
    localStream.getVideoTracks().forEach((t) => (t.enabled = !newOff));
    setState((s) => ({ ...s, cameraOff: newOff }));
  }, [localStream, state.cameraOff]);

  const toggleSpeaker = useCallback(() => {
    setState((s) => ({ ...s, speakerOn: !s.speakerOn }));
  }, []);

  const switchCamera = useCallback(async () => {
    if (!localStream || state.callType !== "video") return;
    const newFacing: "user" | "environment" = state.facing === "user" ? "environment" : "user";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: newFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const newTrack = newStream.getVideoTracks()[0];
      const oldTrack = localStream.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
      if (sender && newTrack) await sender.replaceTrack(newTrack);
      if (oldTrack) { localStream.removeTrack(oldTrack); oldTrack.stop(); }
      if (newTrack) localStream.addTrack(newTrack);
      setState((s) => ({ ...s, facing: newFacing }));
    } catch {
      toast.error("تعذّر تبديل الكاميرا");
    }
  }, [localStream, state.callType, state.facing]);

  // ===== Global incoming-call listener =====
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`calls-incoming:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${user.id}` },
        async (p) => {
          const row = p.new as { id: string; caller_id: string; call_type: CallType; status: string };
          if (statusRef.current !== "idle" && statusRef.current !== "ended") {
            // already busy
            await supabase.from("call_signals").insert({
              call_id: row.id, from_user: user.id, to_user: row.caller_id,
              signal_type: "busy", payload: null,
            });
            await supabase.from("calls").update({ status: "busy", end_reason: "busy", ended_at: new Date().toISOString() }).eq("id", row.id);
            return;
          }
          // Load caller profile
          const { data: prof } = await supabase
            .from("profiles").select("id, username, avatar_url").eq("id", row.caller_id).maybeSingle();
          const peer: PeerProfile = prof ?? { id: row.caller_id, username: "مستخدم", avatar_url: null };

          callIdRef.current = row.id;
          peerIdRef.current = row.caller_id;
          isCallerRef.current = false;
          // Build PC early so we can drain ICE that arrives before accept
          const pc = buildPc();
          pcRef.current = pc;

          setState({
            ...INITIAL,
            status: "ringing-in",
            callId: row.id,
            callType: row.call_type,
            peer,
            isCaller: false,
            startedAt: Date.now(),
          });
          stopRing();
          stopRingRef.current = playRingtone();
          await sendSignal("ringing");

          // Auto-mark missed after 45s
          setTimeout(() => {
            if (callIdRef.current === row.id && !remoteSetRef.current && pcRef.current?.connectionState !== "connected") {
              if (statusRef.current === "ringing-in" || pcRef.current) {
                endCall("missed", false).catch(() => {});
              }
            }
          }, 45000);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, buildPc, sendSignal, endCall]);

  // ===== Per-call signal channel =====
  useEffect(() => {
    if (!user || !state.callId) return;
    const callId = state.callId;
    const ch = supabase
      .channel(`call-signals:${callId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_signals", filter: `call_id=eq.${callId}` },
        async (p) => {
          const s = p.new as { from_user: string; to_user: string; signal_type: string; payload: unknown };
          if (s.to_user !== user.id) return;
          const pc = pcRef.current;
          switch (s.signal_type) {
            case "offer": {
              if (!pc) return;
              const sdp = s.payload as RTCSessionDescriptionInit;
              await pc.setRemoteDescription(sdp);
              remoteSetRef.current = true;
              break;
            }
            case "answer": {
              if (!pc) return;
              const sdp = s.payload as RTCSessionDescriptionInit;
              await pc.setRemoteDescription(sdp);
              remoteSetRef.current = true;
              for (const c of pendingIceRef.current) {
                try { await pc.addIceCandidate(c); } catch { /* noop */ }
              }
              pendingIceRef.current = [];
              setState((st) => st.status === "connected" ? st : { ...st, status: "connecting" });
              break;
            }
            case "ice": {
              if (!pc) return;
              const cand = s.payload as RTCIceCandidateInit;
              if (pc.remoteDescription) {
                try { await pc.addIceCandidate(cand); } catch { /* noop */ }
              } else {
                pendingIceRef.current.push(cand);
              }
              break;
            }
            case "ringing": {
              setState((st) => st.status === "outgoing" ? { ...st, status: "ringing-out" } : st);
              break;
            }
            case "accept": {
              // caller side: answer will follow
              setState((st) => ({ ...st, status: "connecting" }));
              stopDial();
              break;
            }
            case "reject": {
              stopRing(); stopDial();
              toast.info("تم رفض المكالمة");
              await endCall("rejected", false);
              break;
            }
            case "busy": {
              stopDial();
              toast.info("المستخدم مشغول الآن");
              await endCall("rejected", false);
              break;
            }
            case "hangup": {
              await endCall("hangup", false);
              break;
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, state.callId, endCall]);

  // Cleanup on unmount
  useEffect(() => () => { cleanup(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const api: Api = {
    ...state,
    localStream,
    remoteStream,
    startCall,
    accept,
    reject,
    hangup,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    switchCamera,
  };
  // expose channel ref so future tooling can introspect; suppress unused warning
  void signalChRef;
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
