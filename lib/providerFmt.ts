import type { DbBooking } from "@/lib/supabase";

import { locale } from "@/lib/i18n";
export type Period = "morning" | "noon" | "evening" | "asap";

export const PERIOD_LABEL: Record<Period, string> = {
  morning: "صباحاً",
  noon: "ظهراً",
  evening: "مساءً",
  asap: "أسرع وقت",
};

export const PERIOD_HOURS: Record<Exclude<Period, "asap">, string> = {
  morning: "8–12",
  noon: "12–4",
  evening: "4–9",
};

// appointment_time is free text written by the client app:
// "[<weekday day month> ]<period label> (8 - 12)" or "أسرع وقت ممكن".
export function periodOf(text: string | null | undefined): Period {
  const s = text ?? "";
  if (s.includes("صباح")) return "morning";
  if (s.includes("ظهر")) return "noon";
  if (s.includes("مساء")) return "evening";
  return "asap";
}

export function dateLabelOf(text: string | null | undefined): string {
  const s = (text ?? "").trim();
  const m = s.match(/^(.*?)\s*(صباحاً|ظهراً|مساءً|أسرع)/);
  const d = m ? m[1].trim() : "";
  return d || "اليوم";
}

export function isToday(text: string | null | undefined): boolean {
  const s = text ?? "";
  if (periodOf(s) === "asap") return true;
  const today = new Date().toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });
  const d = dateLabelOf(s);
  return d === "اليوم" || s.includes(today);
}

export type BState = "new" | "confirmed" | "onway" | "done" | "cancelled";

export function stateOf(b: Pick<DbBooking, "status" | "on_way_at">): BState {
  if (b.status === "completed") return "done";
  if (b.status === "cancelled") return "cancelled";
  if (b.status === "confirmed") return b.on_way_at ? "onway" : "confirmed";
  return "new";
}

export const STATE_META: Record<BState, { label: string; color: string }> = {
  new: { label: "جديد", color: "#c9a84c" },
  confirmed: { label: "مؤكد", color: "#5b9bf0" },
  onway: { label: "في الطريق", color: "#a78bfa" },
  done: { label: "مكتمل", color: "#1fa65a" },
  cancelled: { label: "ملغي", color: "#e5484d" },
};

export function shortName(n: string | null | undefined): string {
  const parts = (n ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "عميل";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

export function maskPhone(p: string | null | undefined): string {
  const d = (p ?? "").replace(/\D/g, "");
  if (d.length < 6) return d;
  return `${d.slice(0, 3)}•••••${d.slice(-2)}`;
}

export function initialOf(n: string | null | undefined): string {
  return (n ?? "").trim().charAt(0) || "؟";
}
