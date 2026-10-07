import type { DbProvider } from "@/lib/supabase";

// One source of truth for the professional choices a provider must make (sign-up and edit account).
export const DOCTOR_GRADES = ["أخصائي", "استشاري"];
export const NURSE_GRADES = ["أخصائي تمريض", "فني تمريض"];
export const FALLBACK_SPECIALTIES = ["باطنة", "أطفال", "قلب", "صدر", "عظام", "جلدية", "نساء وتوليد", "أنف وأذن", "مخ وأعصاب", "سكر وغدد"];

export function gradesFor(serviceType: string | null | undefined): string[] {
  const s = serviceType ?? "";
  if (s.includes("تمريض")) return NURSE_GRADES;
  if (s.includes("أشعة")) return [];
  return DOCTOR_GRADES;
}

// A doctor needs grade + specialty; a nurse needs the grade; X-ray needs nothing extra.
export function missingProfessionalInfo(p: Pick<DbProvider, "service_type" | "grade" | "specialty">): string[] {
  const grades = gradesFor(p.service_type);
  const missing: string[] = [];
  if (grades.length && !(p.grade && grades.includes(p.grade))) missing.push("الدرجة");
  if ((p.service_type ?? "").includes("كشف") && !p.specialty) missing.push("التخصص");
  return missing;
}
