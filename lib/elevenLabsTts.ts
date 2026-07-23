import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "mizo_eleven_cache_map";

let Audio: any = null;
try { Audio = require("expo-av").Audio; } catch {}

let FileSystem: any = null;
try { FileSystem = require("expo-file-system"); } catch {}

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
    if (FileSystem?.Paths && FileSystem?.File && FileSystem?.Directory) {
      const dir = new FileSystem.Directory(FileSystem.Paths.document("eleven_cache"));
      if (!dir.exists) dir.create();
      const file = new FileSystem.File(FileSystem.Paths.document("eleven_cache", filename));
      file.write(bytes);
      return file.uri;
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
  const filename = `${cacheKey.replace(/[^a-z0-9_]/gi, "_")}.mp3`;

  const fileUri = await saveToFile(filename, bytes);
  if (fileUri) {
    cacheMap[cacheKey] = fileUri;
    await saveCacheMap(cacheMap);
    return fileUri;
  }

  // Fallback: base64 data URI (works on some RN versions)
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
    if (FileSystem?.Directory && FileSystem?.Paths) {
      const dir = new FileSystem.Directory(FileSystem.Paths.document("eleven_cache"));
      if (dir.exists) dir.delete();
    }
  } catch {}
  await AsyncStorage.removeItem(CACHE_KEY);
}
