import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// أحداث فيسبوك/إنستجرام (Meta App Events). لو الـ SDK مش موجود في النسخة المثبّتة بنتجاهل من غير أي خطأ.
let logger: { logEvent: (name: string, params?: Record<string, string | number>) => void } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  logger = require("react-native-fbsdk-next").AppEventsLogger;
} catch {}

// Firebase Analytics (Google). Same events as Meta, under Google's standard names so they can be used as Google Ads conversions.
// Works only in builds that include the native module; elsewhere the calls are ignored.
let firebase: { logEvent: (name: string, params?: Record<string, string | number>) => Promise<void> } | null = null;
try {
  if (Platform.OS === "android") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    firebase = require("@react-native-firebase/analytics").default();
  }
} catch {}

export function trackEvent(name: string, params?: Record<string, string | number>) {
  if (Platform.OS === "web") return;
  try { logger?.logEvent(name, params); } catch {}
}

function trackFirebase(name: string, params?: Record<string, string | number>) {
  try { firebase?.logEvent(name, params)?.catch(() => {}); } catch {}
}

// فتح التطبيق (Meta: activate_app ↔ Google: app_open)
export function trackAppOpen() {
  trackFirebase("app_open");
}

const REG_KEY = "malaz.ana.reg.v1";
// تسجيل جديد — مرة واحدة على الجهاز
export async function trackRegistration() {
  try {
    if (await AsyncStorage.getItem(REG_KEY)) return;
    await AsyncStorage.setItem(REG_KEY, "1");
  } catch {}
  trackEvent("fb_mobile_complete_registration");
  trackFirebase("sign_up", { method: "app" });
}

// طلب حجز / استشارة (حدث "Schedule" القياسي في ميتا)
export function trackSchedule(kind: "home_visit" | "consultation" | "quick_request") {
  trackEvent("Schedule", { fb_content_type: kind });
  trackFirebase("schedule", { content_type: kind });
}
