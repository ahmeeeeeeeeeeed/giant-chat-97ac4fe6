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
import type { Session } from "@supabase/supabase-js";

const KEY = "giant.session.v1";
const isNative = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

type StoredSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number | null;
  user_id?: string;
};

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
export async function restoreSessionFromBackup(): Promise<void> {
  if (!isNative()) return;
  try {
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) return;

    const { value } = await Preferences.get({ key: KEY });
    if (!value) return;

    const stored = JSON.parse(value) as StoredSession;
    if (!stored?.access_token || !stored?.refresh_token) return;

    await supabase.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    });
  } catch {
    /* ignore — Supabase will surface auth errors normally */
  }
}
