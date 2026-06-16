import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, MessageCircle, Users, Music, Sparkles } from "lucide-react";
import PermissionsGate, { hasCompletedPermissionsGate } from "@/components/PermissionsGate";

// Local bundled media — shipped inside the APK assets folder and the web build.
const WELCOME_VIDEO = "/media/welcome-video.mp4";
const WELCOME_POSTER = "/media/welcome-poster.jpg";

export const Route = createFileRoute("/")({
  component: Welcome,
  head: () => ({
    links: [
      { rel: "preload", as: "video", href: WELCOME_VIDEO, type: "video/mp4" },
      { rel: "preload", as: "image", href: WELCOME_POSTER },
    ],
  }),
});

function Welcome() {
  const navigate = useNavigate();
  const [needsPerms, setNeedsPerms] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { setNeedsPerms(!hasCompletedPermissionsGate()); }, []);

  const guardedNavigate = (to: "/login" | "/register") => {
    if (!hasCompletedPermissionsGate()) { setNeedsPerms(true); return; }
    navigate({ to });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/app/friends" });
    });
  }, [navigate]);

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background px-6 py-8 text-foreground">
      {needsPerms && <PermissionsGate onDone={() => setNeedsPerms(false)} />}
      {/* Background video (autoplay, muted, loop) with poster fallback */}
      <video
        ref={videoRef}
        src={assetUrl(welcomeVideo.url)}
        poster={assetUrl(welcomePoster.url)}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-70"
      />

      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-background/70 via-background/40 to-background/95" />

      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-24 -end-24 z-0 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -start-24 z-0 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 end-1/4 z-0 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />

      {/* Animated hero illustration */}
      <div className="relative z-10 mx-auto mt-6 h-44 w-full max-w-sm" style={{ animation: "rise 0.8s ease-out both" }}>
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Orbiting rings */}
          <div className="absolute h-40 w-40 rounded-full border-2 border-dashed border-primary/30" style={{ animation: "spin-slow 18s linear infinite" }} />
          <div className="absolute h-28 w-28 rounded-full border-2 border-dashed border-primary/40" style={{ animation: "spin-slow 12s linear infinite reverse" }} />

          {/* Floating avatars */}
          {[
            { left: "8%", top: "10%", emoji: "💬", delay: "0s" },
            { right: "10%", top: "18%", emoji: "🎵", delay: "0.6s" },
            { left: "12%", bottom: "8%", emoji: "👥", delay: "1.1s" },
            { right: "8%", bottom: "12%", emoji: "✨", delay: "1.6s" },
          ].map((p, i) => (
            <div
              key={i}
              className="absolute flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-2xl shadow-lg ring-1 ring-border"
              style={{ ...p, animation: `bob 3.5s ease-in-out ${p.delay} infinite alternate` }}
            >
              {p.emoji}
            </div>
          ))}

          {/* Logo */}
          <div
            className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary via-primary to-success shadow-2xl ring-4 ring-card"
            style={{ animation: "logo-float 3s ease-in-out infinite alternate" }}
          >
            <span className="text-4xl font-black text-primary-foreground drop-shadow">G</span>
            <Sparkles className="absolute -top-2 -end-2 h-5 w-5 animate-pulse text-primary" />
          </div>
        </div>
      </div>

      {/* Brand */}
      <div className="relative z-10 mt-6 flex flex-col items-center text-center" style={{ animation: "rise 0.8s ease-out 0.1s both" }}>
        <h1
          className="bg-gradient-to-b from-foreground to-primary bg-clip-text text-5xl font-black tracking-tight text-transparent"
          style={{ animation: "glow 3s ease-in-out infinite alternate" }}
        >
          Giant
        </h1>
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          دردش • شارك • العب — مجتمعك في مكان واحد
        </p>
      </div>


      {/* Feature highlights */}
      <div className="relative z-10 mx-auto mt-6 grid w-full max-w-sm grid-cols-3 gap-3" style={{ animation: "rise 0.8s ease-out 0.15s both" }}>
        {[
          { Icon: MessageCircle, label: "محادثات" },
          { Icon: Users, label: "غرف" },
          { Icon: Music, label: "موسيقى" },
        ].map(({ Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/70 p-4 backdrop-blur">
            <Icon className="h-6 w-6 text-primary" />
            <span className="text-xs font-bold">{label}</span>
          </div>
        ))}
      </div>

      <div className="flex-1" />

      {/* CTA */}
      <div className="relative z-10 mx-auto w-full max-w-sm space-y-3" style={{ animation: "rise 0.8s ease-out 0.3s both" }}>
        <button
          type="button"
          onClick={() => guardedNavigate("/login")}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-success text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98]"
        >
          <LogIn className="h-5 w-5" />
          تسجيل الدخول
        </button>

        <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>أو</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={() => guardedNavigate("/register")}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card text-base font-bold text-foreground transition active:scale-[0.98] hover:bg-accent"
        >
          إنشاء حساب جديد
        </button>

        <p className="px-2 pt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          بمتابعتك أنت توافق على{" "}
          <span className="underline">اتفاقية المستخدم</span> و{" "}
          <span className="underline">سياسة الخصوصية</span>
        </p>
      </div>

      <style>{`
        @keyframes rise {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes logo-float {
          0% { transform: translateY(0) rotate(-3deg); }
          100% { transform: translateY(-6px) rotate(3deg); }
        }
        @keyframes glow {
          0% { filter: drop-shadow(0 0 6px color-mix(in oklab, var(--primary) 30%, transparent)); }
          100% { filter: drop-shadow(0 0 18px color-mix(in oklab, var(--primary) 55%, transparent)); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes bob {
          0% { transform: translateY(0); }
          100% { transform: translateY(-10px); }
        }
      `}</style>
    </main>
  );
}

