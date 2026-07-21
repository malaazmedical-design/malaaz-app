import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

const KEYS = {
  profile: "mizo_profile",
  localEvents: "mizo_local_events",
  customWords: "mizo_custom_words",
};

export type VoiceType = "male" | "female" | "child";

export type MizoProfile = {
  patientName: string;
  voiceType: VoiceType;
};

export type AacEvent = {
  id: string;
  word_id: string;
  phrase: string;
  category: string;
  is_emergency: boolean;
  created_at: string;
};

export type CustomWord = {
  id: string;
  label: string;
  emoji: string;
  phrase: string;
  category_id: string;
};

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<MizoProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.profile);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { patientName: "المريض", voiceType: "male" };
}

export async function saveProfile(profile: MizoProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.profile, JSON.stringify(profile));
}

// ─── Voice settings ───────────────────────────────────────────────────────────

export function getVoiceOptions(voiceType: VoiceType) {
  switch (voiceType) {
    case "female": return { language: "ar-EG", rate: 0.82, pitch: 1.25 };
    case "child":  return { language: "ar-EG", rate: 0.78, pitch: 1.55 };
    default:       return { language: "ar-EG", rate: 0.82, pitch: 1.0  };
  }
}

// ─── Events ──────────────────────────────────────────────────────────────────

export async function logEvent(event: Omit<AacEvent, "id" | "created_at">): Promise<void> {
  const newEvent: AacEvent = {
    ...event,
    id: Date.now().toString(),
    created_at: new Date().toISOString(),
  };

  // حفظ محلي أولاً
  try {
    const raw = await AsyncStorage.getItem(KEYS.localEvents);
    const events: AacEvent[] = raw ? JSON.parse(raw) : [];
    events.unshift(newEvent);
    await AsyncStorage.setItem(KEYS.localEvents, JSON.stringify(events.slice(0, 200)));
  } catch {}

  // رفع لـ Supabase في الخلفية لو في جلسة
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from("aac_events").insert({
        user_id: session.user.id,
        word_id: event.word_id,
        phrase: event.phrase,
        category: event.category,
        is_emergency: event.is_emergency,
      });
    }
  } catch {}
}

export async function getLocalEvents(): Promise<AacEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.localEvents);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearLocalEvents(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.localEvents);
}

// ─── Custom words ─────────────────────────────────────────────────────────────

export async function getCustomWords(): Promise<CustomWord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.customWords);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addCustomWord(word: Omit<CustomWord, "id">): Promise<CustomWord> {
  const newWord: CustomWord = { ...word, id: `custom_${Date.now()}` };
  const existing = await getCustomWords();
  existing.push(newWord);
  await AsyncStorage.setItem(KEYS.customWords, JSON.stringify(existing));

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from("aac_custom_words").insert({
        user_id: session.user.id,
        ...word,
      });
    }
  } catch {}

  return newWord;
}

export async function deleteCustomWord(id: string): Promise<void> {
  const existing = await getCustomWords();
  const filtered = existing.filter((w) => w.id !== id);
  await AsyncStorage.setItem(KEYS.customWords, JSON.stringify(filtered));
}
