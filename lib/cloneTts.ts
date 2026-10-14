import { getVoiceProfile } from "@/lib/voiceProfiles";
import { supabase } from "@/lib/supabase";

const SUPABASE_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

let Audio: any = null;
try { Audio = require("expo-av").Audio; } catch {}
let FS: any = null;
try { FS = require("expo-file-system/legacy"); } catch {}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Short stable hash so the filename tracks the phrase text (custom/edited cards).
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Cache is per profile + per phrase, never shared between patients.
async function getAudioUri(profileId: string, voiceId: string, wordId: string, phrase: string): Promise<string | null> {
  const dir = FS?.documentDirectory ? `${FS.documentDirectory}voice_cache/${profileId}/` : null;
  const file = dir ? `${dir}${wordId.replace(/[^a-z0-9_]/gi, "_")}_${hash(phrase)}.mp3` : null;

  if (file) {
    try {
      const info = await FS.getInfoAsync(file);
      if (info.exists) return file;
    } catch {}
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? SUPABASE_ANON_KEY;
  const res = await fetch(`${SUPABASE_BASE}/functions/v1/voice-tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ voice_id: voiceId, phrase }),
  });
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  const b64 = uint8ToBase64(bytes);

  if (file && dir) {
    try {
      await FS.makeDirectoryAsync(dir, { intermediates: true });
      await FS.writeAsStringAsync(file, b64, { encoding: "base64" });
      return file;
    } catch {}
  }
  return `data:audio/mpeg;base64,${b64}`;
}

// Returns true if it played, false if the caller should fall back to another engine.
export async function cloneSpeak(
  phrase: string,
  wordId: string,
  profileId: string,
  onDone?: () => void,
): Promise<boolean> {
  if (!Audio) throw new Error("NEEDS_NATIVE_BUILD");
  const profile = await getVoiceProfile(profileId);
  if (!profile || profile.status !== "ready" || !profile.voiceId) return false;

  const uri = await getAudioUri(profileId, profile.voiceId, wordId || "free", phrase);
  if (!uri) return false;

  await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
  const { sound } = await Audio.Sound.createAsync({ uri });
  await sound.playAsync();
  sound.setOnPlaybackStatusUpdate((s: any) => {
    if (s.isLoaded && s.didJustFinish) { sound.unloadAsync(); onDone?.(); }
  });
  return true;
}
