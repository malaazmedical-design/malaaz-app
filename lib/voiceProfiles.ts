import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

const KEY = "mizo_voice_profiles";
const SUPABASE_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

let FS: any = null;
try { FS = require("expo-file-system/legacy"); } catch {}

export type VoiceProfileStatus = "recorded" | "cloning" | "ready" | "error";

export type VoiceProfile = {
  id: string;
  name: string;               // e.g. "أبويا", "ماما"
  status: VoiceProfileStatus;
  sampleUri: string;          // persisted copy of the recorded sample
  voiceId?: string;           // provider voice id, set once cloned
  consentAt: string;          // ISO time the consent box was ticked
  createdAt: string;
  error?: string;
};

// Minimum sample length that gives a usable clone.
export const MIN_SAMPLE_SECONDS = 30;

export async function getVoiceProfiles(): Promise<VoiceProfile[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveAll(list: VoiceProfile[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function getVoiceProfile(id: string): Promise<VoiceProfile | null> {
  return (await getVoiceProfiles()).find((p) => p.id === id) ?? null;
}

async function patchProfile(id: string, patch: Partial<VoiceProfile>): Promise<void> {
  const list = await getVoiceProfiles();
  await saveAll(list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

// Copies the temp recording into the app's document dir so it survives cache cleanup.
async function persistSample(id: string, tempUri: string): Promise<string> {
  if (!FS?.documentDirectory) return tempUri;
  const dir = FS.documentDirectory + "voice_samples/";
  await FS.makeDirectoryAsync(dir, { intermediates: true });
  const ext = tempUri.split(".").pop()?.split("?")[0] || "m4a";
  const dest = `${dir}${id}.${ext}`;
  await FS.copyAsync({ from: tempUri, to: dest });
  return dest;
}

export async function addVoiceProfile(name: string, tempSampleUri: string): Promise<VoiceProfile> {
  const id = `vp_${Date.now()}`;
  const sampleUri = await persistSample(id, tempSampleUri);
  const now = new Date().toISOString();
  const profile: VoiceProfile = {
    id, name: name.trim() || "بصمة صوت", status: "recorded",
    sampleUri, consentAt: now, createdAt: now,
  };
  await saveAll([...(await getVoiceProfiles()), profile]);
  return profile;
}

async function callEdge(fn: string, body: unknown): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? SUPABASE_ANON_KEY;
  return fetch(`${SUPABASE_BASE}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

// Uploads the sample to the `voice-clone` edge function, which holds the
// provider API key server-side and returns only an opaque voice id.
export async function cloneVoiceProfile(id: string): Promise<VoiceProfile> {
  const profile = await getVoiceProfile(id);
  if (!profile) throw new Error("Profile not found");
  if (!FS) throw new Error("NEEDS_NATIVE_BUILD");

  await patchProfile(id, { status: "cloning", error: undefined });
  try {
    const audio_base64 = await FS.readAsStringAsync(profile.sampleUri, { encoding: "base64" });
    const ext = profile.sampleUri.split(".").pop()?.toLowerCase() ?? "m4a";
    const res = await callEdge("voice-clone", {
      action: "create",
      name: `${profile.name} (${id})`,
      audio_base64,
      mime: ext === "wav" ? "audio/wav" : ext === "mp3" ? "audio/mpeg" : "audio/mp4",
      filename: `${id}.${ext}`,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.voice_id) throw new Error(json.error ?? `Clone failed (${res.status})`);
    await patchProfile(id, { status: "ready", voiceId: json.voice_id });
  } catch (e: any) {
    await patchProfile(id, { status: "error", error: String(e?.message ?? e) });
    throw e;
  }
  return (await getVoiceProfile(id))!;
}

// Removes the profile locally (sample + generated audio) and from the provider.
export async function deleteVoiceProfile(id: string): Promise<void> {
  const profile = await getVoiceProfile(id);
  if (profile?.voiceId) {
    try { await callEdge("voice-clone", { action: "delete", voice_id: profile.voiceId }); } catch {}
  }
  try {
    if (FS?.documentDirectory) {
      await FS.deleteAsync(profile?.sampleUri ?? "", { idempotent: true });
      await FS.deleteAsync(`${FS.documentDirectory}voice_cache/${id}/`, { idempotent: true });
    }
  } catch {}
  await saveAll((await getVoiceProfiles()).filter((p) => p.id !== id));
}
