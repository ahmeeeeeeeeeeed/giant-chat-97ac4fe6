// ICE servers for WebRTC. Uses free Google STUN + Open Relay TURN by default.
// You can override TURN by setting VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL
// (e.g. self-hosted coturn) without code changes.

export function getIceServers(): RTCIceServer[] {
  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  const turnUser = import.meta.env.VITE_TURN_USERNAME as string | undefined;
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];

  if (turnUrl && turnUser && turnCred) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
  } else {
    // Free public TURN fallback (Open Relay Project) so calls work behind
    // strict NAT / corporate firewalls without paying for Twilio/Agora.
    servers.push(
      { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
    );
  }
  return servers;
}
