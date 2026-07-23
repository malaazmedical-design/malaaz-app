import * as Speech from "expo-speech";
import { getVoiceOptions } from "@/lib/mizoStorage";
import type { MizoProfile } from "@/lib/mizoStorage";

// Azure TTS and per-word recording require a native build that includes
// expo-av and expo-file-system. Until then, all modes fall back to device TTS.

export async function mizoSpeak(
  phrase: string,
  _wordId: string,
  profile: Pick<MizoProfile, "ttsMode" | "azureVoice" | "azureKey" | "azureRegion" | "voiceType">,
  onDone?: () => void,
): Promise<void> {
  const { voiceType } = profile;
  const opts = getVoiceOptions(voiceType);
  Speech.speak(phrase, { ...opts, onDone, onError: onDone });
}
