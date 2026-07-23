import { File, Directory, Paths } from "expo-file-system";
import { Audio } from "expo-av";
import type { AzureVoice } from "@/lib/mizoStorage";

function getCacheDir(): Directory {
  return new Directory(Paths.document, "mizo_azure_cache");
}

function getCacheFile(wordId: string, voice: AzureVoice): File {
  return new File(getCacheDir(), `${wordId}_${voice}.mp3`);
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
  if (!key || !region) throw new Error("Azure key/region not set");

  const cacheFile = getCacheFile(wordId, voice);

  if (!cacheFile.exists) {
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

    const buffer = await response.arrayBuffer();
    getCacheDir().create({ intermediates: true, idempotent: true });
    cacheFile.write(new Uint8Array(buffer));
  }

  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  const { sound } = await Audio.Sound.createAsync({ uri: cacheFile.uri });
  await sound.playAsync();
  sound.setOnPlaybackStatusUpdate((s) => {
    if (s.isLoaded && s.didJustFinish) {
      sound.unloadAsync();
      onDone?.();
    }
  });
}

export async function clearAzureCache(): Promise<void> {
  const dir = getCacheDir();
  if (dir.exists) dir.delete();
}
