import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Welcome,
});

const TILES = [
  "https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=400&q=70",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=70",
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&q=70",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=70",
  "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=400&q=70",
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=400&q=70",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=70",
  "https://images.unsplash.com/photo-1503443207922-dff7d543fd0e?auto=format&fit=crop&w=400&q=70",
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=400&q=70",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=70",
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=400&q=70",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=70",
];

function Welcome() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/app/friends" });
      else setChecking(false);
    });
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-black text-white">
      {/* Image grid background */}
      <div className="absolute inset-0 grid grid-cols-3 auto-rows-[28%] gap-1 opacity-90">
        {TILES.map((src, i) => (
          <div
            key={i}
            className="relative overflow-hidden bg-neutral-900"
            style={{ animation: `tile-float ${8 + (i % 5)}s ease-in-out ${i * 0.3}s infinite alternate` }}
          >
            <img
              src={src}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-[8000ms] ease-in-out hover:scale-110"
              style={{ animation: `tile-zoom ${12 + (i % 4)}s ease-in-out ${i * 0.5}s infinite alternate` }}
            />
          </div>
        ))}
      </div>

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/80" />

      {/* Center title */}
      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-between px-6 py-10">
        <div className="flex-1" />

        <div className="text-center" style={{ animation: "title-pop 1s ease-out both" }}>
          <h1 className="text-7xl font-black tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]"
            style={{ animation: "title-glow 3s ease-in-out infinite alternate" }}>
            BIMO
          </h1>
          <p className="mt-3 text-sm font-semibold opacity-90">
            46,023 شخص وجدوا مجتمعهم
          </p>
        </div>

        <div className="flex-1" />

        {/* CTA */}
        <div className="w-full max-w-sm space-y-3" style={{ animation: "cta-rise 0.8s ease-out 0.3s both" }}>
          <Link
            to="/login"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-base font-bold text-black shadow-2xl transition active:scale-95"
          >
            <LogIn className="h-5 w-5" />
            تسجيل الدخول باستخدام الاسم
          </Link>

          <div className="flex items-center gap-3 py-1 text-xs opacity-80">
            <div className="h-px flex-1 bg-white/30" />
            <span>Or</span>
            <div className="h-px flex-1 bg-white/30" />
          </div>

          <Link
            to="/signup"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white/10 px-6 text-base font-bold text-white backdrop-blur-sm ring-1 ring-white/40 transition active:scale-95 hover:bg-white/15"
          >
            إنشاء حساب جديد
          </Link>

          <p className="px-2 pt-2 text-center text-[11px] leading-relaxed opacity-80">
            يعني النقر لتسجيل الدخول أنك قرأت ووافقت{" "}
            <span className="underline">اتفاقية المستخدم</span> و{" "}
            <span className="underline">اتفاقية الخصوصية</span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes tile-float {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-12px); }
        }
        @keyframes tile-zoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.15); }
        }
        @keyframes title-pop {
          0% { opacity: 0; transform: scale(0.6); }
          70% { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes title-glow {
          0% { text-shadow: 0 0 18px rgba(255,255,255,0.25), 0 4px 24px rgba(0,0,0,0.8); }
          100% { text-shadow: 0 0 36px rgba(255,255,255,0.55), 0 4px 24px rgba(0,0,0,0.8); }
        }
        @keyframes cta-rise {
          0% { opacity: 0; transform: translateY(24px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
