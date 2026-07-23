import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AzureVoice } from "@/lib/mizoStorage";

const CACHE_KEY = "mizo_azure_cache_map";

// expo-av loaded lazily for OTA safety
let Audio: any = null;
try { Audio = require("expo-av").Audio; } catch {}

async function getCacheMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function buildSsml(text: string, voice: AzureVoice): string {
  return `<speak version='1.0' xml:lang='ar-EG'><voice xml:lang='ar-EG' name='${voice}'>${text}</voice></speak>`;
}

export async function azureSpeak(
  phrase: string,
  wordId: string,
  voice: AzureVoice,
  key: string,
  region: string,
  onDone?: () => void,
): Promise<void> {
  if (!Audio) throw new Error("NEEDS_NATIVE_BUILD");
  if (!key || !region) throw new Error("Azure key/region not set");

  const cacheMap = await getCacheMap();
  let uri = cacheMap[`${wordId}_${voice}`];

  if (!uri) {
    const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
        "User-Agent": "MizoAAC",
      },
      body: buildSsml(phrase, voice),
    });
    if (!response.ok) throw new Error(`Azure TTS error: ${response.status}`);
    // Without expo-file-system we can't cache to disk — play via blob URI
    const blob = await response.blob();
    uri = URL.createObjectURL(blob);
  }

  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  const { sound } = await Audio.Sound.createAsync({ uri });
  await sound.playAsync();
  sound.setOnPlaybackStatusUpdate((s: any) => {
    if (s.isLoaded && s.didJustFinish) { sound.unloadAsync(); onDone?.(); }
  });
}

export async function clearAzureCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}
