import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// أحداث فيسبوك/إنستجرام (Meta App Events). لو الـ SDK مش موجود في النسخة المثبّتة بنتجاهل من غير أي خطأ.
let logger: { logEvent: (name: string, params?: Record<string, string | number>) => void } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  logger = require("react-native-fbsdk-next").AppEventsLogger;
} catch {}

export function trackEvent(name: string, params?: Record<string, string | number>) {
  if (Platform.OS === "web") return;
  try { logger?.logEvent(name, params); } catch {}
}

const REG_KEY = "malaz.ana.reg.v1";
// تسجيل جديد — مرة واحدة على الجهاز
export async function trackRegistration() {
  try {
    if (await AsyncStorage.getItem(REG_KEY)) return;
    await AsyncStorage.setItem(REG_KEY, "1");
  } catch {}
  trackEvent("fb_mobile_complete_registration");
}

// طلب حجز / استشارة (حدث "Schedule" القياسي في ميتا)
export function trackSchedule(kind: "home_visit" | "consultation" | "quick_request") {
  trackEvent("Schedule", { fb_content_type: kind });
}
