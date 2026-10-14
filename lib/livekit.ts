// Lazy, crash-proof loader for the LiveKit native SDK.
// Old installs (APK built before voice/video shipped) have no native WebRTC module: requiring it throws, so every
// caller must handle `null` and fall back to the chat room. New builds load it once and register the WebRTC globals.
type LK = {
  rn: typeof import("@livekit/react-native");
  client: typeof import("livekit-client");
  webrtc: typeof import("@livekit/react-native-webrtc");
};

let cache: LK | null | undefined;

export function getLiveKit(): LK | null {
  if (cache !== undefined) return cache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webrtc = require("@livekit/react-native-webrtc");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require("@livekit/react-native");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const client = require("livekit-client");
    if (!webrtc?.mediaDevices) throw new Error("webrtc native module missing");
    rn.registerGlobals();
    cache = { rn, client, webrtc };
  } catch {
    cache = null;
  }
  return cache;
}
