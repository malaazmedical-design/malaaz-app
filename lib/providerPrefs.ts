import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export type FontSize = "n" | "l" | "xl";
export type Lang = "ar" | "en";
type Prefs = { notifications: boolean; fontSize: FontSize; lang: Lang };

const KEY = "malaz.provider.prefs.v1";
let prefs: Prefs = { notifications: true, fontSize: "n", lang: "ar" };
const listeners = new Set<() => void>();
let loaded = false;

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) prefs = { ...prefs, ...JSON.parse(raw) };
    listeners.forEach((l) => l());
  } catch {}
}

export function setProviderPref<K extends keyof Prefs>(k: K, v: Prefs[K]) {
  prefs = { ...prefs, [k]: v };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => {});
}

const SCALE: Record<FontSize, number> = { n: 1, l: 1.1, xl: 1.2 };

export function useProviderPrefs() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    load();
    return () => { listeners.delete(l); };
  }, []);
  return { ...prefs, fontScale: SCALE[prefs.fontSize] };
}
