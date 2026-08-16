import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// SecureStore adapter — بيحفظ الـ auth tokens مشفّرة في Android Keystore / iOS Keychain
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// أثناء الـ static export للويب مفيش window، فلازم نعطّل تخزين الجلسة
const isServer = Platform.OS === "web" && typeof window === "undefined";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    ...(Platform.OS === "web" ? {} : { storage: secureStorage }),
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
});

// React Native بيوقف الـ timers وقت ما التطبيق في الخلفية، فالـ token مايتجددش
// تلقائي — لازم نتحكم في الـ auto-refresh يدوي مع كل رجوع للتطبيق (توصية Supabase الرسمية)
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
} else if (typeof document !== "undefined") {
  // الويب: نجدد الـ token لما المستخدم يرجع للتاب
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

// ─── Database Types (مطابقة لجداول Supabase بتاع ملاذ) ──────────────────────

// service_type في القاعدة بالعربي: "كشف منزلي" | "تمريض منزلي" | "أشعة منزلية"
export type DbProvider = {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  service_type: string;
  specialty: string | null;
  grade: string | null;
  area: string | null;
  areas: string | null; // قائمة مناطق مفصولة بفواصل
  bio: string | null;
  experience: string | null;
  rating: string | number | null;
  price: string | number | null;
  status: "active" | "pending" | "suspended" | string;
  is_available: boolean | null;
  photo_url: string | null;
  created_at: string;
  lat: number | null;
  lng: number | null;
  location_updated_at: string | null;
};

export type DbBooking = {
  id: string;
  patient_name: string;
  phone: string;
  area: string | null;
  address: string | null;
  appointment_time: string | null;
  service_type: string;
  sub_option: string | null;
  payment_method: string | null;
  payment_status: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled" | string;
  notes: string | null;
  provider_phone: string | null;
  lat?: number | null;
  lng?: number | null;
  escalation_level?: number | null;
  provider_id: string | null;
  price: number | string | null;
  patient_email: string | null;
  client_id: string | null;
  on_way_at: string | null;
  created_at: string;
};

export type DbClientAddress = {
  id: string;
  client_id: string;
  area: string | null;
  address: string;
  is_default: boolean;
  created_at: string;
};

export type DbFamilyMember = {
  id: string;
  client_id: string;
  name: string;
  relation: string | null;
  birth_year: number | null;
  notes: string | null;
  phone: string | null;
  gender: string | null;
  blood_type: string | null;
  chronic_conditions: string | null;
  allergies: string | null;
  created_at: string;
};

export type DbMedicalFile = {
  id: string;
  client_id: string;
  family_member_id: string | null;
  title: string;
  file_type: "report" | "lab" | "xray" | "prescription" | "other";
  storage_path: string;
  created_at: string;
};

export type DbMedicineReminder = {
  id: string;
  client_id: string;
  family_member_id: string | null;
  medicine_name: string;
  dose: string | null;
  times: string[];
  notify_caregiver: boolean;
  active: boolean;
  created_at: string;
};

export type DbReview = {
  id: string;
  provider_id: string | null;
  client_name: string;
  service_type: string | null;
  rating: number;
  text: string | null;
  is_approved: boolean;
  created_at: string;
};

export type DbService = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  price_min: number | null;
  price_max: number | null;
  is_active: boolean;
  created_at: string;
};

export type DbSubService = {
  id: string;
  service_name: string;
  group_name: string | null;
  name: string;
  duration: string | null;
  price_min: number | null;
  price_max: number | null;
  price_min_specialist: number | null;
  price_max_specialist: number | null;
  price_min_consultant: number | null;
  price_max_consultant: number | null;
  is_active: boolean;
  created_at: string;
};

export type DbProviderService = {
  id: string;
  provider_id: string;
  sub_service_id: string;
  custom_price: number | null;
  is_active: boolean;
};

export type DbCoverageArea = {
  id: string;
  city: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type DbBookingOffer = {
  id: string;
  booking_id: string;
  provider_id: string;
  distance_km: number | null;
  status: "pending" | "accepted" | "expired" | "declined";
  created_at: string;
  responded_at: string | null;
};

// نتيجة get_offer_details RPC — بيانات محدودة عن الحجز (من غير بيانات تواصل المريض) لحد ما المقدم يقبل العرض
export type OfferDetails = {
  service_type: string | null;
  sub_option: string | null;
  area: string | null;
  appointment_time: string | null;
  distance_km: number | null;
};

export type DbClient = {
  id: string;
  auth_id: string | null;
  name: string | null;
  phone: string | null;
  phone2: string | null;
  whatsapp: string | null;
  email: string | null;
  created_at: string;
};
