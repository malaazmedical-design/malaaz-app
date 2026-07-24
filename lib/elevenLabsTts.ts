import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "mizo_eleven_cache_map";

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
    // expo-file-system v19 API
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

async function fetchAndCache(
  phrase: string,
  voiceId: string,
  apiKey: string,
  cacheKey: string,
): Promise<string> {
  const filename = `${cacheKey.replace(/[^a-z0-9_]/gi, "_")}.mp3`;

  // Check file cache first
  const existingFile = await getFileUri(filename);
  if (existingFile) return existingFile;

  // Check AsyncStorage map (for base64 fallback entries)
  const cacheMap = await getCacheMap();
  if (cacheMap[cacheKey]) return cacheMap[cacheKey];

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

  // Try file storage (v19 API)
  const fileUri = await saveToFile(filename, bytes);
  if (fileUri) return fileUri;

  // Fallback: store base64 data URI in AsyncStorage
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
): Promise<void> {
  if (!Audio) throw new Error("NEEDS_NATIVE_BUILD");
  if (!apiKey || !voiceId) throw new Error("ElevenLabs config missing");

  const uri = await fetchAndCache(phrase, voiceId, apiKey, `${wordId}_${voiceId.slice(0, 20)}`);

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
