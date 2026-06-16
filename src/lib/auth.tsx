import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { backupSession, clearSessionBackup, restoreSessionFromBackup } from "./session-store";
import { getOnline } from "./use-online";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};
const Ctx = createContext<AuthCtx>({ session: null, user: null, loading: true });
let explicitSignOutInProgress = false;

function isNetworkFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Failed to fetch|NetworkError|Load failed|fetch/i.test(message);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evt, s) => {
      // Defensive: ignore transient null sessions (token refresh failures,
      // offline app-resume, etc.). Only an explicit SIGNED_OUT / USER_DELETED
      // event — or an explicit user sign-out in progress — should clear the
      // session. This prevents auto-logout/hang when the app resumes from
      // background with a flaky network.
      if (!s && evt !== "SIGNED_OUT" && !explicitSignOutInProgress) {
        setLoading(false);
        return;
      }
      setSession(s);
      setLoading(false);
      // Mirror session to native secure storage (Capacitor Preferences on Android).
      // No-op on web — Supabase already persists to localStorage there.
      void backupSession(s);
      if (evt === "SIGNED_OUT") {
        void clearSessionBackup();
      }
      if (evt === "SIGNED_IN" && s?.user) {
        // Fire-and-forget login record (country + timestamp + IP via server fn)
        import("./login-history.functions")
          .then((m) => m.recordLogin())
          .catch((e) => {
            if (!isNetworkFailure(e)) console.warn("[login-history] record failed", e);
          });
      }
    });
    // First try to restore from native backup (offline-safe), then read current session.
    (async () => {
      const restored = await restoreSessionFromBackup();
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? restored);
      setLoading(false);
    })();
    return () => subscription.unsubscribe();
  }, []);

  return <Ctx.Provider value={{ session, user: session?.user ?? null, loading }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

// Username-only auth: map username -> synthetic email
export const usernameToEmail = (u: string) =>
  `${u.trim().toLowerCase().replace(/[^a-z0-9_]/g, "")}@giant.app`;

export async function signUpWithUsername(username: string, password: string) {
  const clean = username.trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
    return { error: "اسم المستخدم: 3-20 حرف، أحرف إنجليزية وأرقام و _ فقط" };
  }
  if (password.length < 6) return { error: "كلمة المرور 6 أحرف على الأقل" };

  // check unique username
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", clean)
    .maybeSingle();
  if (existing) return { error: "اسم المستخدم مستخدم بالفعل" };

  const { error } = await supabase.auth.signUp({
    email: usernameToEmail(clean),
    password,
    options: { data: { username: clean } },
  });
  if (error) return { error: error.message };
  return { error: null };
}

export async function signInWithUsername(username: string, password: string) {
  const clean = username.trim();
  // Prefer the real auth email stored in profiles (supports Arabic/decorated premium names).
  let email = usernameToEmail(clean);
  try {
    const { data } = await supabase.rpc("lookup_auth_email", { _username: clean } as never);
    if (typeof data === "string" && data.includes("@")) email = data;
  } catch { /* fall back to synthetic email */ }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
  return { error: null };
}

export async function signOut() {
  explicitSignOutInProgress = true;
  try {
    // Use 'local' scope so signOut never blocks on the network.
    // This always clears the local Supabase session (and fires SIGNED_OUT),
    // even when the device is offline. The server session, if any, expires
    // on its own. Tokens are also wiped from the native backup below.
    try {
      await supabase.auth.signOut({ scope: "local" } as never);
    } catch {
      /* offline or transient — fall through and force-clear locally */
    }
    try { await clearSessionBackup(); } catch { /* ignore */ }
    // Defensive: force-clear Supabase persisted session from web storage
    // in case the SDK call above was a no-op due to a network failure.
    try {
      if (typeof localStorage !== "undefined") {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))
          .forEach((k) => localStorage.removeItem(k));
      }
    } catch { /* ignore */ }
  } finally {
    explicitSignOutInProgress = false;
  }
}
