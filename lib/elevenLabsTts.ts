import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "mizo_eleven_cache_map";
const SUPABASE_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_TTS_URL = `${SUPABASE_BASE}/storage/v1/object/public/mizo-tts`;
const SUPABASE_EDGE_URL = `${SUPABASE_BASE}/functions/v1/tts-generate`;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

let Audio: any = null;
try { Audio = require("expo-av").Audio; } catch {}

// expo-file-system v19 (compatible with Expo SDK 54)
let FS: any = null;
try { FS = require("expo-file-system"); } catch {}

async function getCacheMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function saveCacheMap(map: Record<string, string>): Promise<void> {
  try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch {}
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function saveToFile(filename: string, bytes: Uint8Array): Promise<string | null> {
  try {
    if (FS?.documentDirectory && typeof FS.writeAsStringAsync === "function") {
      const dir = FS.documentDirectory + "eleven_cache/";
      await FS.makeDirectoryAsync(dir, { intermediates: true });
      const path = dir + filename;
      const base64 = uint8ToBase64(bytes);
      await FS.writeAsStringAsync(path, base64, { encoding: "base64" });
      return path;
    }
  } catch {}
  return null;
}

async function getFileUri(filename: string): Promise<string | null> {
  try {
    if (FS?.documentDirectory && typeof FS.getInfoAsync === "function") {
      const path = FS.documentDirectory + "eleven_cache/" + filename;
      const info = await FS.getInfoAsync(path);
      if (info.exists) return path;
    }
  } catch {}
  return null;
}

async function downloadAndCache(filename: string, url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const path = await saveToFile(filename, bytes);
    if (path) return path;
    return `data:audio/mpeg;base64,${uint8ToBase64(bytes)}`;
  } catch {
    return null;
  }
}

// Try Supabase Storage; if missing, ask Edge Function to generate on demand.
// Custom words (custom_) are skipped — they're personal and not shared.
async function fetchFromSupabase(wordId: string, phrase?: string, gender: "male" | "female" = "male"): Promise<string | null> {
  const storageName = gender === "female" ? `${wordId}_f` : wordId;
  const filename = `supabase_${storageName}.mp3`;
  const cached = await getFileUri(filename);
  if (cached) return cached;

  const publicUrl = `${SUPABASE_TTS_URL}/${storageName}.mp3`;

  // 1. Try the already-generated file
  const direct = await downloadAndCache(filename, publicUrl);
  if (direct) return direct;

  // 2. Not found — ask Edge Function to generate it on demand
  if (!phrase) return null;
  try {
    const res = await fetch(SUPABASE_EDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ word_id: wordId, phrase, gender }),
    });
    if (!res.ok) return null;
    // Edge Function returns audio bytes directly — save and play
    const bytes = new Uint8Array(await res.arrayBuffer());
    const path = await saveToFile(filename, bytes);
    if (path) return path;
    return `data:audio/mpeg;base64,${uint8ToBase64(bytes)}`;
  } catch {
    return null;
  }
}

async function fetchAndCache(
  phrase: string,
  voiceId: string,
  apiKey: string,
  cacheKey: string,
  wordId?: string,
  gender: "male" | "female" = "male",
): Promise<string> {
  // 1. Check Supabase cache; generate on demand if missing (standard words only)
  if (wordId && !wordId.startsWith("custom_")) {
    const supabaseUri = await fetchFromSupabase(wordId, phrase, gender);
    if (supabaseUri) return supabaseUri;
  }

  const filename = `${cacheKey.replace(/[^a-z0-9_]/gi, "_")}.mp3`;

  // 2. Check local file cache
  const existingFile = await getFileUri(filename);
  if (existingFile) return existingFile;

  // 3. Check AsyncStorage map (for base64 fallback entries)
  const cacheMap = await getCacheMap();
  if (cacheMap[cacheKey]) return cacheMap[cacheKey];

  if (!apiKey) throw new Error("ElevenLabs API key missing");

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: phrase,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  );
  if (!response.ok) throw new Error(`ElevenLabs error: ${response.status}`);

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const fileUri = await saveToFile(filename, bytes);
  if (fileUri) return fileUri;

  const uri = `data:audio/mpeg;base64,${uint8ToBase64(bytes)}`;
  cacheMap[cacheKey] = uri;
  await saveCacheMap(cacheMap);
  return uri;
}

export async function elevenLabsSpeak(
  phrase: string,
  wordId: string,
  voiceId: string,
  apiKey: string,
  onDone?: () => void,
  gender: "male" | "female" = "male",
): Promise<void> {
  if (!Audio) throw new Error("NEEDS_NATIVE_BUILD");
  const isCustom = wordId.startsWith("custom_");
  if (isCustom && (!apiKey || !voiceId)) throw new Error("ElevenLabs config missing");

  const uri = await fetchAndCache(phrase, voiceId, apiKey, `${wordId}_${voiceId.slice(0, 20)}_${gender}`, wordId, gender);

  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  const { sound } = await Audio.Sound.createAsync({ uri });
  await sound.playAsync();
  sound.setOnPlaybackStatusUpdate((s: any) => {
    if (s.isLoaded && s.didJustFinish) { sound.unloadAsync(); onDone?.(); }
  });
}

export async function clearElevenLabsCache(): Promise<void> {
  try {
    if (FS?.documentDirectory && typeof FS.deleteAsync === "function") {
      const dir = FS.documentDirectory + "eleven_cache/";
      await FS.deleteAsync(dir, { idempotent: true });
    }
  } catch {}
  await AsyncStorage.removeItem(CACHE_KEY);
}
