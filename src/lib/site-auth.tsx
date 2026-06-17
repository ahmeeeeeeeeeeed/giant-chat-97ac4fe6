import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type SiteAuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isSiteAccount: boolean;
};

const Ctx = createContext<SiteAuthCtx>({
  session: null,
  user: null,
  loading: true,
  isSiteAccount: false,
});

export function isSiteUser(u: User | null | undefined): boolean {
  if (!u) return false;
  if (u.user_metadata?.kind === "site") return true;
  // Google sign-ins via the broker won't have kind set; treat any non-app
  // synthetic email as a site account.
  const email = u.email ?? "";
  return email.length > 0 && !email.endsWith("@giant.app");
}

export function SiteAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  return (
    <Ctx.Provider value={{ session, user, loading, isSiteAccount: isSiteUser(user) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSiteAuth = () => useContext(Ctx);

export async function signUpSiteEmail(email: string, password: string, displayName?: string) {
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { kind: "site", display_name: displayName?.trim() || null },
      emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/site/account` : undefined,
    },
  });
  if (error) return { error: error.message };
  return { error: null };
}

export async function signInSiteEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { error: "البريد أو كلمة المرور غير صحيحة" };
  return { error: null };
}

export async function signInSiteGoogle() {
  const { lovable } = await import("@/integrations/lovable");
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin + "/site/account",
  });
  return result;
}

export async function signOutSite() {
  try { await supabase.auth.signOut({ scope: "local" } as never); } catch { /* ignore */ }
}
