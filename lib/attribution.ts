import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// مصدر التثبيت (أندرويد): بلاي ستور بيحفظ بارامترات رابط التحميل (utm_source=... إلخ) والتطبيق بيقراها أول مرة بيفتح،
// ويبعتها للسيرفر أول ما يبقى فيه مستخدم مسجّل دخول. لو النسخة المثبّتة قديمة (من غير expo-application) بنتجاهل بهدوء.
const KEY = "malaz.attr.v1";
type Stored = { referrer: string | null; platform: string; synced: boolean };

export async function captureInstallAttribution(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    if (await AsyncStorage.getItem(KEY)) return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Application = require("expo-application");
    const referrer: string | null = (await Application.getInstallReferrerAsync()) || null;
    const v: Stored = { referrer, platform: "android", synced: false };
    await AsyncStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // الوحدة مش موجودة في النسخة دي أو الجهاز مش من بلاي ستور — هنحاول تاني في الفتح الجاي
  }
}

let syncing = false;
export async function syncAttribution(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return;
    const v = JSON.parse(raw) as Stored;
    if (v.synced) return;
    const { data, error } = await supabase.rpc("record_install_attribution", { p_referrer: v.referrer, p_platform: v.platform });
    if (!error && (data === "ok" || data === "exists")) await AsyncStorage.setItem(KEY, JSON.stringify({ ...v, synced: true }));
  } catch {} finally { syncing = false; }
}
