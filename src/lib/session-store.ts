// Native-safe backup of the Supabase session tokens.
//
// On Android (Capacitor) we mirror access_token / refresh_token into the
// secure Preferences store so that:
//   - the session survives WebView storage purges,
//   - on cold boot without internet we can hydrate Supabase immediately,
//   - signOut wipes the backup completely.
//
// We NEVER store passwords — only the short-lived access token and the
// rotating refresh token (which Supabase itself manages).

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

const KEY = "giant.session.v1";
const isNative = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

type StoredSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number | null;
  user_id?: string;
  session?: Session;
};

function parseJwtPayload(token: string): Record<string, any> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function fallbackSession(stored: StoredSession | null): Session | null {
  if (!stored?.access_token || !stored.refresh_token) return stored?.session ?? null;
  const claims = parseJwtPayload(stored.access_token);
  const userId = stored.user_id ?? claims?.sub;
  if (!userId) return stored.session ?? null;
  const nowIso = new Date().toISOString();
  const user: User = {
    id: userId,
    app_metadata: claims?.app_metadata ?? {},
    user_metadata: claims?.user_metadata ?? {},
    aud: claims?.aud ?? "authenticated",
    email: claims?.email,
    phone: claims?.phone,
    role: claims?.role ?? "authenticated",
    created_at: claims?.iat ? new Date(Number(claims.iat) * 1000).toISOString() : nowIso,
    updated_at: nowIso,
  };
  return {
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
    expires_at: stored.expires_at ?? claims?.exp ?? Math.floor(Date.now() / 1000) + 3600,
    expires_in: Math.max(0, Number((stored.expires_at ?? claims?.exp ?? Math.floor(Date.now() / 1000) + 3600)) - Math.floor(Date.now() / 1000)),
    token_type: "bearer",
    user,
  };
}

export async function backupSession(session: Session | null): Promise<void> {
  if (!isNative()) return;
  try {
    if (!session?.refresh_token) {
      await Preferences.remove({ key: KEY });
      return;
    }
    const payload: StoredSession = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at ?? null,
      user_id: session.user?.id,
      session,
    };
    await Preferences.set({ key: KEY, value: JSON.stringify(payload) });
  } catch {
    /* ignore — local backup is best-effort */
  }
}

export async function clearSessionBackup(): Promise<void> {
  if (!isNative()) return;
  try { await Preferences.remove({ key: KEY }); } catch { /* ignore */ }
}

/**
 * On Android, if Supabase has no session in WebView storage (e.g. it was
 * cleared by the OS) but we still have a refresh_token in Preferences,
 * push it back into Supabase so the user remains signed in — even offline.
 *
 * Safe to call on every cold start; it's a no-op when a session already
 * exists or when running on the web.
 */
export async function restoreSessionFromBackup(): Promise<Session | null> {
  if (!isNative()) return null;
  try {
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) return existing.session;

    const { value } = await Preferences.get({ key: KEY });
    if (!value) return null;

    const stored = JSON.parse(value) as StoredSession;
    if (!stored?.access_token || !stored?.refresh_token) return fallbackSession(stored);

    const { data } = await supabase.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    });
    return data.session ?? fallbackSession(stored);
  } catch {
    try {
      const { value } = await Preferences.get({ key: KEY });
      const stored = value ? (JSON.parse(value) as StoredSession) : null;
      return fallbackSession(stored);
    } catch {
      return null;
    }
  }
}
