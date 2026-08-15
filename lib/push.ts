import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

// ملحوظة: إشعارات الـ push بتشتغل في نسخة التطبيق المبنية (APK / TestFlight)
// — مش في Expo Go (قيود SDK 53+). الكود بيفشل بهدوء لو مش متاحة.

let cachedToken: string | null = null;

export async function getExpoPushToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    if (Platform.OS === "web" || !Device.isDevice) return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "إشعارات ملاذ",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#C9A84C",
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    if (!projectId || projectId === "YOUR_EAS_PROJECT_ID") return null;

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    cachedToken = token.data;
    return cachedToken;
  } catch (e) {
    console.warn("push token error:", e);
    return null;
  }
}

// تسجيل توكن العميل (بالموبايل — مفيش حسابات للعملاء في التطبيق)
export async function registerClientPushToken(phone: string): Promise<void> {
  if (!phone) return;
  const token = await getExpoPushToken();
  if (!token) return;
  await supabase
    .from("push_tokens")
    .upsert(
      { owner_type: "client", phone, expo_token: token, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: "expo_token" }
    );
}

// تسجيل توكن مقدم الخدمة
export async function registerProviderPushToken(providerId: string): Promise<void> {
  if (!providerId) return;
  const token = await getExpoPushToken();
  if (!token) return;
  await supabase
    .from("push_tokens")
    .upsert(
      { owner_type: "provider", provider_id: providerId, expo_token: token, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: "expo_token" }
    );
}

// إشعار المقدم لما العميل يلغي الحجز — fire and forget
export async function notifyProviderCancellation(
  providerId: string,
  patientName: string,
  serviceType: string,
  area: string | null
): Promise<void> {
  try {
    const { data } = await supabase
      .from("push_tokens")
      .select("expo_token")
      .eq("owner_type", "provider")
      .eq("provider_id", providerId)
      .maybeSingle();
    if (!data?.expo_token) return;
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: data.expo_token,
        title: "❌ إلغاء حجز",
        body: `${patientName} ألغى الحجز — ${serviceType}${area ? ` (${area})` : ""}`,
        data: { type: "booking_cancelled" },
        sound: "default",
        priority: "high",
      }),
    });
  } catch {}
}

// هل العميل ده عنده التطبيق؟ (عشان نبعت إيميل بس لو معندوش)
export async function clientHasPushToken(phone: string | null): Promise<boolean> {
  if (!phone) return false;
  try {
    const { data, error } = await supabase.rpc("has_push_token", { p_phone: phone });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}
