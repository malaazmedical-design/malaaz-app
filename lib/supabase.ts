import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://sjaktzqolztzsipjkrts.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── Database Types (مطابقة لجداول Supabase بتاع ملاذ) ──────────────────────

export type DbProvider = {
  id: string;
  full_name: string;
  specialty: "doctor" | "nurse" | "xray";
  service_type: string;
  rating: number | null;
  reviews_count: number | null;
  experience_years: number | null;
  coverage_areas: string[] | null;
  bio: string | null;
  phone: string;
  email: string | null;
  photo_url: string | null;
  status: "active" | "pending" | "suspended";
  available: boolean | null;
  response_time: string | null;
  created_at: string;
};

export type DbBooking = {
  id: string;
  client_name: string;
  client_phone: string;
  client_address: string;
  service_type: string;
  service_name: string;
  service_price: number | null;
  provider_id: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  payment_method: "cash" | "vodafone_cash" | null;
  notes: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  area: string | null;
  city: string | null;
  created_at: string;
};

export type DbReview = {
  id: string;
  booking_id: string;
  provider_id: string;
  client_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type DbUser = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  address: string | null;
  area: string | null;
  city: string | null;
  created_at: string;
};
