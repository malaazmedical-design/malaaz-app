import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { Alert } from "react-native";


// UI language. The layout stays right-to-left in both languages (final decision for now), only the texts change.
export type Lang = "ar" | "en";
const KEY = "malaz.lang.v1";

let lang: Lang = "ar";
const subs = new Set<() => void>();
const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };

export const getLang = (): Lang => lang;
export const locale = (): string => (lang === "en" ? "en-US" : "ar-EG");

export async function loadLang(): Promise<void> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === "en" || v === "ar") { lang = v; subs.forEach((f) => f()); }
  } catch {}
}

export async function setLang(next: Lang): Promise<void> {
  lang = next;
  subs.forEach((f) => f());
  try { await AsyncStorage.setItem(KEY, next); } catch {}
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

import { supabase } from "../supabase";
import { setDynamicNames, translate } from "./translate";

// Translate one Arabic UI string when the app language is English (names, notes and other server data stay as they are).
export function tr(s: string): string {
  return lang === "en" ? translate(s, tr) : s;
}

// Alert.alert goes through the same dictionary
let patched = false;
export function patchAlert() {
  if (patched) return;
  patched = true;
  const orig = Alert.alert.bind(Alert);
  Alert.alert = (title: string, message?: string, buttons?: any, options?: any) =>
    orig(
      tr(title),
      message ? tr(message) : message,
      Array.isArray(buttons) ? buttons.map((b: any) => (b && typeof b.text === "string" ? { ...b, text: tr(b.text) } : b)) : buttons,
      options,
    );
}

// English names of specialties, governorates, cities and services (admin fills them in; Arabic stays the fallback)
export async function loadEnglishNames(): Promise<void> {
  try {
    const map: Record<string, string> = {};
    const [a, b, c] = await Promise.all([
      supabase.from("sub_services").select("name,name_en").not("name_en", "is", null),
      supabase.from("coverage_areas").select("name,name_en").not("name_en", "is", null),
      supabase.from("governorates").select("name,name_en").not("name_en", "is", null),
    ]);
    for (const r of [...(a.data ?? []), ...(b.data ?? []), ...(c.data ?? [])] as { name: string; name_en: string }[]) map[r.name] = r.name_en;
    setDynamicNames(map);
    subs.forEach((f) => f());
  } catch {}
}
