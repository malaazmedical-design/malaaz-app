import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

const KEYS = {
  profile: "mizo_profile",
  localEvents: "mizo_local_events",
  customWords: "mizo_custom_words",
  familyLinks: "mizo_family_links",
  contacts: "mizo_contacts",
  wordCustomizations: "mizo_word_customizations",
};

export type VoiceType =
  | "male_1" | "male_2" | "male_3"
  | "female_1" | "female_2" | "female_3"
  | "child_1" | "child_2" | "child_3"
  | "male" | "female" | "child"; // backward compat

export type MizoProfile = {
  patientName: string;
  voiceType: VoiceType;
  patientMode: boolean;
  patientPin: string;
  dwellTime: number;           // ms: 0=off, 500, 1000, 1500
  quietHoursEnabled: boolean;
  quietHoursStart: number;     // 22
  quietHoursEnd: number;       // 7
  oneHandedMode: boolean;
  userType: string;            // "stroke" | "deaf" | "child" | "nonverbal" | ""
};

const DEFAULT_PROFILE: MizoProfile = {
  patientName: "المريض",
  voiceType: "male",
  patientMode: false,
  patientPin: "1234",
  dwellTime: 0,
  quietHoursEnabled: false,
  quietHoursStart: 22,
  quietHoursEnd: 7,
  oneHandedMode: false,
  userType: "",
};

export type MizoFamilyLink = {
  id: string;
  family_name: string;
  relation: string;
  push_token: string;
  phone: string;
  notify_emergency_only: boolean;
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

export type ContactNotifyMode = "all" | "direct_only" | "emergency_only";

export type MizoContact = {
  id: string;
  name: string;
  relation: string;
  photo: string | null;
  phrase: string;
  color: string;
  push_token?: string;
  notify_mode?: ContactNotifyMode;
  is_primary?: boolean;
};

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<MizoProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.profile);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PROFILE };
}

export async function saveProfile(profile: MizoProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.profile, JSON.stringify(profile));
}

// ─── Voice settings ───────────────────────────────────────────────────────────

export function getVoiceOptions(voiceType: VoiceType) {
  switch (voiceType) {
    case "male_1":   return { language: "ar-EG", rate: 0.75, pitch: 0.80 };
    case "male_2":
    case "male":     return { language: "ar-EG", rate: 0.82, pitch: 1.00 };
    case "male_3":   return { language: "ar-EG", rate: 0.88, pitch: 1.18 };
    case "female_1": return { language: "ar-EG", rate: 0.78, pitch: 1.20 };
    case "female_2":
    case "female":   return { language: "ar-EG", rate: 0.82, pitch: 1.38 };
    case "female_3": return { language: "ar-EG", rate: 0.87, pitch: 1.55 };
    case "child_1":  return { language: "ar-EG", rate: 0.75, pitch: 1.45 };
    case "child_2":
    case "child":    return { language: "ar-EG", rate: 0.80, pitch: 1.65 };
    case "child_3":  return { language: "ar-EG", rate: 0.88, pitch: 1.85 };
    default:         return { language: "ar-EG", rate: 0.82, pitch: 1.00 };
  }
}

// ─── Family links ─────────────────────────────────────────────────────────────

export async function getFamilyLinks(): Promise<MizoFamilyLink[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase
        .from("aac_family_links")
        .select("*")
        .eq("patient_user_id", session.user.id);
      if (data && data.length > 0) {
        const links: MizoFamilyLink[] = data.map((d) => ({
          id: d.id,
          family_name: d.family_name,
          relation: d.relation ?? "",
          push_token: d.push_token ?? "",
          phone: d.phone ?? "",
          notify_emergency_only: d.notify_emergency_only ?? false,
        }));
        await AsyncStorage.setItem(KEYS.familyLinks, JSON.stringify(links));
        return links;
      }
    }
  } catch {}
  try {
    const raw = await AsyncStorage.getItem(KEYS.familyLinks);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addFamilyLink(link: Omit<MizoFamilyLink, "id">): Promise<MizoFamilyLink> {
  const newLink: MizoFamilyLink = { ...link, id: `fl_${Date.now()}` };
  const existing = await getFamilyLinks();
  existing.push(newLink);
  await AsyncStorage.setItem(KEYS.familyLinks, JSON.stringify(existing));

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from("aac_family_links").insert({
        patient_user_id: session.user.id,
        family_name: link.family_name,
        relation: link.relation,
        push_token: link.push_token,
        phone: link.phone,
        notify_emergency_only: link.notify_emergency_only,
      });
    }
  } catch {}

  return newLink;
}

export async function deleteFamilyLink(id: string): Promise<void> {
  const existing = await getFamilyLinks();
  const filtered = existing.filter((l) => l.id !== id);
  await AsyncStorage.setItem(KEYS.familyLinks, JSON.stringify(filtered));

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user && !id.startsWith("fl_")) {
      await supabase
        .from("aac_family_links")
        .delete()
        .eq("id", id)
        .eq("patient_user_id", session.user.id);
    }
  } catch {}
}

async function pushSend(token: string, title: string, body: string, isEmergency: boolean, extra?: object) {
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "Accept-Encoding": "gzip, deflate" },
      body: JSON.stringify({
        to: token, title, body, sound: "default",
        priority: isEmergency ? "high" : "normal",
        data: { type: "mizo_request", is_emergency: isEmergency, ...extra },
      }),
    });
  } catch {}
}

export async function sendFamilyNotification(
  patientName: string,
  phrase: string,
  isEmergency: boolean,
  quietEnabled: boolean,
  quietStart: number,
  quietEnd: number,
): Promise<void> {
  if (quietEnabled && !isEmergency) {
    const hour = new Date().getHours();
    const inQuiet = quietStart > quietEnd
      ? (hour >= quietStart || hour < quietEnd)
      : (hour >= quietStart && hour < quietEnd);
    if (inQuiet) return;
  }

  const title = `ميزو — ${patientName}`;

  // Family links (existing)
  const links = await getFamilyLinks();
  for (const link of links.filter((l) => !l.notify_emergency_only || isEmergency)) {
    if (link.push_token) await pushSend(link.push_token, title, phrase, isEmergency);
  }

  // Contacts with push tokens: "all" mode always, "emergency_only" on emergency
  const contacts = await getContacts();
  for (const c of contacts) {
    if (!c.push_token) continue;
    const mode = c.notify_mode ?? "direct_only";
    if (mode === "all" || (mode === "emergency_only" && isEmergency)) {
      await pushSend(c.push_token, title, phrase, isEmergency);
    }
  }
}

// Mark one contact as primary (clears is_primary on all others)
export async function setPrimaryContact(contactId: string): Promise<void> {
  const contacts = await getContacts();
  const updated = contacts.map((c) => ({ ...c, is_primary: c.id === contactId }));
  await AsyncStorage.setItem(KEYS.contacts, JSON.stringify(updated));
}

// Send buzzer notification only to the designated primary contact
export async function notifyPrimaryContact(
  patientName: string,
  phrase: string,
  quietEnabled: boolean,
  quietStart: number,
  quietEnd: number,
): Promise<void> {
  if (quietEnabled) {
    const hour = new Date().getHours();
    const inQuiet = quietStart > quietEnd
      ? (hour >= quietStart || hour < quietEnd)
      : (hour >= quietStart && hour < quietEnd);
    if (inQuiet) return;
  }
  const contacts = await getContacts();
  const primary = contacts.find((c) => c.is_primary && c.push_token);
  if (!primary) return;
  await pushSend(primary.push_token!, `ميزو — ${patientName}`, phrase, false, { type: "buzzer" });
}

// Send notification directly to one contact when their card is pressed
export async function sendContactDirectNotification(
  contact: MizoContact,
  patientName: string,
): Promise<void> {
  if (!contact.push_token) return;
  await pushSend(
    contact.push_token,
    `ميزو — ${patientName}`,
    contact.phrase,
    false,
    { contact_id: contact.id, direct: true },
  );
}

// ─── Events ──────────────────────────────────────────────────────────────────

export async function logEvent(event: Omit<AacEvent, "id" | "created_at">): Promise<void> {
  const newEvent: AacEvent = {
    ...event,
    id: Date.now().toString(),
    created_at: new Date().toISOString(),
  };

  try {
    const raw = await AsyncStorage.getItem(KEYS.localEvents);
    const events: AacEvent[] = raw ? JSON.parse(raw) : [];
    events.unshift(newEvent);
    await AsyncStorage.setItem(KEYS.localEvents, JSON.stringify(events.slice(0, 200)));
  } catch {}

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

// ─── Family contacts (AAC photo cards) ───────────────────────────────────────

const CONTACT_COLORS = ["#2E7D6B", "#1C5C8A", "#7B3F8C", "#B85C1A", "#1A6B4A", "#8C3A3A"];

export async function getContacts(): Promise<MizoContact[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.contacts);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addContact(contact: Omit<MizoContact, "id" | "color">): Promise<MizoContact> {
  const existing = await getContacts();
  const color = CONTACT_COLORS[existing.length % CONTACT_COLORS.length];
  const newContact: MizoContact = { ...contact, id: `contact_${Date.now()}`, color };
  existing.push(newContact);
  await AsyncStorage.setItem(KEYS.contacts, JSON.stringify(existing));
  return newContact;
}

export async function updateContact(id: string, patch: Partial<Omit<MizoContact, "id">>): Promise<void> {
  const existing = await getContacts();
  const idx = existing.findIndex((c) => c.id === id);
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...patch };
    await AsyncStorage.setItem(KEYS.contacts, JSON.stringify(existing));
  }
}

export async function deleteContact(id: string): Promise<void> {
  const existing = await getContacts();
  await AsyncStorage.setItem(KEYS.contacts, JSON.stringify(existing.filter((c) => c.id !== id)));
}

// ─── Word customizations (personalize hardcoded cards) ────────────────────────

export type WordCustomization = {
  label?: string;
  photo?: string | null;
  color?: string;
};

export async function getWordCustomizations(): Promise<Record<string, WordCustomization>> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.wordCustomizations);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export async function setWordCustomization(wordId: string, custom: WordCustomization): Promise<void> {
  const existing = await getWordCustomizations();
  existing[wordId] = { ...existing[wordId], ...custom };
  await AsyncStorage.setItem(KEYS.wordCustomizations, JSON.stringify(existing));
}

export async function clearWordCustomization(wordId: string): Promise<void> {
  const existing = await getWordCustomizations();
  delete existing[wordId];
  await AsyncStorage.setItem(KEYS.wordCustomizations, JSON.stringify(existing));
}
