// Permissions for an audio/video call before opening the mic/camera.
import { ensureMicPermission, ensureCameraPermission } from "@/lib/app-permissions";

export async function ensureCallPermissions(video: boolean): Promise<boolean> {
  const mic = await ensureMicPermission();
  if (!mic) return false;
  if (video) {
    const cam = await ensureCameraPermission();
    if (!cam) return false;
  }
  return true;
}

export function getMediaConstraints(video: boolean): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: video
      ? {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: "user",
        }
      : false,
  };
}
