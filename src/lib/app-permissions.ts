// Runtime permission helpers. All are safe to call on the web — Capacitor
// plugin imports are dynamic so missing plugins (e.g. running in a browser)
// turn into a no-op. Use these from UI handlers right before the feature is
// needed (Android requires a runtime prompt for camera / mic / notifications).

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Ask for push + local notification permission. Returns true if granted. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (await isNative()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const cur = await LocalNotifications.checkPermissions();
      if (cur.display === "granted") return true;
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== "granted") return false;
    } catch { /* plugin missing */ }
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const cur = await PushNotifications.checkPermissions();
      if (cur.receive !== "granted") {
        const req = await PushNotifications.requestPermissions();
        if (req.receive !== "granted") return false;
      }
      await PushNotifications.register();
    } catch { /* push optional */ }
    return true;
  }
  // Web fallback
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") return true;
    const p = await Notification.requestPermission();
    return p === "granted";
  }
  return false;
}

/** Ask for camera permission (still photo / video capture). */
export async function ensureCameraPermission(): Promise<boolean> {
  if (await isNative()) {
    try {
      const { Camera } = await import("@capacitor/camera");
      const cur = await Camera.checkPermissions();
      if (cur.camera === "granted") return true;
      const req = await Camera.requestPermissions({ permissions: ["camera", "photos"] });
      return req.camera === "granted";
    } catch { return false; }
  }
  return true; // browser file input handles its own prompt
}

/** Ask for microphone permission (voice messages / calls via getUserMedia). */
export async function ensureMicPermission(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

/** Ask for permission to read images & videos from the device gallery. */
export async function ensureMediaLibraryPermission(): Promise<boolean> {
  if (await isNative()) {
    try {
      const { Camera } = await import("@capacitor/camera");
      const cur = await Camera.checkPermissions();
      if (cur.photos === "granted" || cur.photos === "limited") return true;
      const req = await Camera.requestPermissions({ permissions: ["photos"] });
      return req.photos === "granted" || req.photos === "limited";
    } catch { return false; }
  }
  return true;
}

/** Best-effort: ask for all common permissions at app first launch. */
export async function requestAllAppPermissions(): Promise<void> {
  await ensureNotificationPermission().catch(() => {});
  await ensureCameraPermission().catch(() => {});
  await ensureMediaLibraryPermission().catch(() => {});
  // Mic prompt is deferred until the user actually presses a voice button —
  // calling getUserMedia eagerly would surprise users with an OS prompt.
}
