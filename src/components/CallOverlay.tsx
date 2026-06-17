import { useEffect, useRef, useState } from "react";
import { useCalls } from "@/lib/use-calls";
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff, Volume2, VolumeX, RefreshCw, PhoneIncoming } from "lucide-react";
import { useCachedMediaSource } from "@/lib/use-cached-media";

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function statusLabel(status: string, isCaller: boolean): string {
  switch (status) {
    case "outgoing": return "جاري الاتصال…";
    case "ringing-out": return "يرن…";
    case "ringing-in": return "مكالمة واردة";
    case "connecting": return "جاري الاتصال…";
    case "connected": return "متصل";
    case "ended": return "انتهت المكالمة";
    default: return isCaller ? "جاري الاتصال…" : "مكالمة واردة";
  }
}

export function CallOverlay() {
  const call = useCalls();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [now, setNow] = useState(Date.now());

  // Tick for duration display
  useEffect(() => {
    if (call.status !== "connected") return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [call.status]);

  // Bind streams to media elements
  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = call.localStream;
  }, [call.localStream, call.status]);
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = call.remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = call.remoteStream;
  }, [call.remoteStream]);

  // Speaker routing (sinkId is Chromium-only; gracefully ignored elsewhere)
  useEffect(() => {
    const el = remoteAudioRef.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (!el || !el.setSinkId) return;
    el.setSinkId(call.speakerOn ? "default" : "default").catch(() => {});
  }, [call.speakerOn]);

  const avatar = useCachedMediaSource(call.peer?.avatar_url ?? null);

  if (call.status === "idle") return null;

  const duration = call.connectedAt ? Math.floor((now - call.connectedAt) / 1000) : 0;
  const isVideo = call.callType === "video";
  const hasRemoteVideo = isVideo && !!call.remoteStream && call.remoteStream.getVideoTracks().some((t) => t.enabled);
  const showVideoUI = isVideo && (call.status === "connecting" || call.status === "connected");

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white" dir="rtl">
      {/* Remote video full-screen for video calls */}
      {showVideoUI && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`absolute inset-0 h-full w-full object-cover ${hasRemoteVideo ? "" : "hidden"}`}
        />
      )}
      {/* Always-on hidden audio sink for the remote stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Overlay (avatar + name + status) when no remote video */}
      {!hasRemoteVideo && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pt-16">
          <div className="relative">
            <div className="absolute inset-0 -m-3 rounded-full bg-emerald-400/20 animate-ping" />
            <div className="relative h-36 w-36 overflow-hidden rounded-full ring-4 ring-white/15 shadow-2xl">
              {avatar ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500 to-cyan-600 text-5xl font-bold">
                  {call.peer?.username?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>
          </div>
          <h2 className="mt-6 text-2xl font-semibold">{call.peer?.username ?? "مستخدم"}</h2>
          <p className="mt-2 text-sm text-white/70">
            {call.status === "connected" ? fmtDuration(duration) : statusLabel(call.status, call.isCaller)}
          </p>
          {call.status !== "connected" && (
            <p className="mt-1 text-xs text-white/50">
              {isVideo ? "مكالمة فيديو" : "مكالمة صوتية"}
            </p>
          )}
        </div>
      )}

      {/* Header strip when on remote video */}
      {hasRemoteVideo && (
        <div className="absolute top-0 right-0 left-0 z-20 flex items-center gap-3 bg-gradient-to-b from-black/60 to-transparent p-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
          <div className="h-10 w-10 overflow-hidden rounded-full ring-2 ring-white/20">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-emerald-500" />}
          </div>
          <div className="flex-1">
            <div className="font-semibold">{call.peer?.username ?? "مستخدم"}</div>
            <div className="text-xs text-white/70">{call.status === "connected" ? fmtDuration(duration) : statusLabel(call.status, call.isCaller)}</div>
          </div>
        </div>
      )}

      {/* Local PiP for video calls */}
      {showVideoUI && call.localStream && !call.cameraOff && (
        <div className="absolute bottom-32 end-4 z-20 h-40 w-28 overflow-hidden rounded-2xl border border-white/20 shadow-xl">
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        </div>
      )}

      {/* Controls */}
      <div className="relative z-20 pb-8 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}>
        {call.status === "ringing-in" ? (
          <div className="mx-auto flex max-w-md items-center justify-around px-8">
            <button
              onClick={() => call.reject()}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-2xl active:scale-95 transition"
              aria-label="رفض"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
            <button
              onClick={() => call.accept()}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 shadow-2xl active:scale-95 transition animate-pulse"
              aria-label="قبول"
            >
              <Phone className="h-7 w-7" />
            </button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-md items-center justify-around px-6">
            <CtrlBtn active={call.muted} onClick={call.toggleMute} ariaLabel="كتم">
              {call.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </CtrlBtn>
            {isVideo && (
              <CtrlBtn active={call.cameraOff} onClick={call.toggleCamera} ariaLabel="كاميرا">
                {call.cameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
              </CtrlBtn>
            )}
            {isVideo && (
              <CtrlBtn active={false} onClick={call.switchCamera} ariaLabel="تبديل الكاميرا">
                <RefreshCw className="h-6 w-6" />
              </CtrlBtn>
            )}
            {!isVideo && (
              <CtrlBtn active={call.speakerOn} onClick={call.toggleSpeaker} ariaLabel="سماعة">
                {call.speakerOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
              </CtrlBtn>
            )}
            <button
              onClick={() => call.hangup()}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-2xl active:scale-95 transition"
              aria-label="إنهاء"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
          </div>
        )}

        {call.status === "ringing-in" && (
          <p className="mt-4 text-center text-xs text-white/60 flex items-center justify-center gap-1.5">
            <PhoneIncoming className="h-3.5 w-3.5" />
            {isVideo ? "مكالمة فيديو واردة" : "مكالمة صوتية واردة"}
          </p>
        )}
      </div>
    </div>
  );
}

function CtrlBtn({
  active, onClick, ariaLabel, children,
}: { active: boolean; onClick: () => void; ariaLabel: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`flex h-14 w-14 items-center justify-center rounded-full backdrop-blur transition active:scale-95 ${
        active ? "bg-white text-slate-900" : "bg-white/15 text-white hover:bg-white/25"
      }`}
    >
      {children}
    </button>
  );
}
