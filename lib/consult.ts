import type { DbConsultation } from "@/lib/supabase";

import { locale } from "@/lib/i18n";
export const PERIOD_LABEL: Record<string, string> = {
  morning: "صباحًا (8 - 12)",
  noon: "ظهرًا (12 - 4)",
  evening: "مساءً (4 - 9)",
  asap: "أسرع وقت ممكن",
};

export const PAY_LABEL: Record<string, string> = { wallet: "محفظة إلكترونية (فودافون كاش)", instapay: "إنستاباي" };
export const FOLLOW_LABEL: Record<string, string> = { none: "لا يلزم متابعة", week: "بعد أسبوع", two: "بعد أسبوعين", month: "بعد شهر" };
export const CHANNEL_LABEL: Record<string, string> = { chat: "شات", voice: "صوت", video: "فيديو" };

export function dayLabel(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });
}
export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit" });
}
export function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString(locale(), { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function endAt(c: DbConsultation): number | null {
  if (!c.started_at) return null;
  return new Date(c.started_at).getTime() + (c.duration_min + c.extra_min) * 60000;
}

// ما يراه العميل والطبيب: مرحلة واحدة واضحة لكل استشارة
export type Stage =
  | "pay_pending" | "cancelled" | "need_time" | "time_pending" | "time_rejected" | "scheduled"
  | "doctor_late" | "live" | "need_summary" | "no_show" | "done";

export function stageOf(c: DbConsultation, now = Date.now()): Stage {
  if (c.pay_status === "cancelled") return "cancelled";
  if (c.pay_status === "pending") return "pay_pending";
  if (c.state === "live") return "live";
  if (c.state === "ended") return c.no_show ? "no_show" : c.sum_at ? "done" : "need_summary";
  if (c.prop_status === "pending") return "time_pending";
  if (c.prop_status === "no") return "time_rejected";
  if (c.prop_status === "ok" && c.appt_at) {
    return now >= new Date(c.appt_at).getTime() + 15 * 60000 ? "doctor_late" : "scheduled";
  }
  return "need_time";
}

export const STAGE_META: Record<Stage, { client: string; doctor: string; color: string }> = {
  pay_pending:   { client: "في انتظار الدفع",       doctor: "في انتظار الدفع",        color: "#c9a84c" },
  cancelled:     { client: "تم الإلغاء",             doctor: "تم الإلغاء",             color: "#e5484d" },
  need_time:     { client: "تم الدفع · بانتظار الموعد", doctor: "حدد الموعد",           color: "#2f80ed" },
  time_pending:  { client: "موعد بانتظار موافقتك",   doctor: "بانتظار رد المريض",      color: "#c9a84c" },
  time_rejected: { client: "بانتظار موعد جديد",      doctor: "المريض لا يناسبه الموعد", color: "#e5484d" },
  scheduled:     { client: "الموعد مؤكد",            doctor: "الموعد مؤكد",            color: "#1fa65a" },
  doctor_late:   { client: "تأخر الطبيب قليلًا",     doctor: "متأخر عن الموعد",        color: "#e5484d" },
  live:          { client: "جارية الآن",             doctor: "جارية الآن",             color: "#1fa65a" },
  need_summary:  { client: "بانتظار ملخص الطبيب",    doctor: "اكتب الملخص",            color: "#2f80ed" },
  no_show:       { client: "لم تحضر الجلسة",         doctor: "لم يحضر المريض",         color: "#6b7a7c" },
  done:          { client: "اكتملت",                 doctor: "اكتملت",                 color: "#6b7a7c" },
};

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
