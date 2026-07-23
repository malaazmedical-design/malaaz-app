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
    if (hasRecording(wordId)) {
      await playRecording(wordId, onDone);
      return;
    }
    // fallthrough to device TTS if no recording exists yet
  }

  if (ttsMode === "azure" && azureKey) {
    try {
      await azureSpeak(phrase, wordId, azureVoice, azureKey, azureRegion, onDone);
      return;
    } catch {
      // fallthrough to device TTS on Azure error
    }
  }

  // device TTS (default / fallback)
  const opts = getVoiceOptions(voiceType);
  Speech.speak(phrase, { ...opts, onDone, onError: onDone });
}
