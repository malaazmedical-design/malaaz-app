import * as Speech from "expo-speech";
import { azureSpeak } from "@/lib/azureTts";
import { hasRecording, playRecording } from "@/lib/mizoRecording";
import { getVoiceOptions } from "@/lib/mizoStorage";
import type { MizoProfile } from "@/lib/mizoStorage";

export async function mizoSpeak(
  phrase: string,
  wordId: string,
  profile: Pick<MizoProfile, "ttsMode" | "azureVoice" | "azureKey" | "azureRegion" | "voiceType">,
  onDone?: () => void,
): Promise<void> {
  const { ttsMode, azureVoice, azureKey, azureRegion, voiceType } = profile;

  if (ttsMode === "recorded") {
    const exists = await hasRecording(wordId);
    if (exists) {
      try {
        await playRecording(wordId, onDone);
        return;
      } catch (e: any) {
        if (e?.message === "NEEDS_NATIVE_BUILD") {
          // fall through silently to device TTS
        }
      }
    }
  }

  if (ttsMode === "azure" && azureKey) {
    try {
      await azureSpeak(phrase, wordId, azureVoice, azureKey, azureRegion, onDone);
      return;
    } catch (e: any) {
      if (e?.message !== "NEEDS_NATIVE_BUILD") console.warn("Azure TTS failed:", e);
    }
  }

  const opts = getVoiceOptions(voiceType);
  Speech.speak(phrase, { ...opts, onDone, onError: onDone });
}
