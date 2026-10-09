import type { DbProvider } from "@/lib/supabase";

// One source of truth for the professional choices a provider must make (sign-up and edit account).
export const DOCTOR_GRADES = ["أخصائي", "استشاري"];
export const NURSE_GRADES = ["أخصائي تمريض", "فني تمريض"];
export const XRAY_TYPES = ["مركز أشعة"];

// Label of the "grade" choice per provider type (final design): doctor = الدرجة العلمية · nurse = المسمى الوظيفي · X-ray = نوع الجهة
export function gradeLabelFor(serviceType: string | null | undefined): string {
  const s = serviceType ?? "";
  if (s.includes("تمريض")) return "المسمى الوظيفي";
  if (s.includes("أشعة")) return "نوع الجهة";
  return "الدرجة العلمية";
}
export const FALLBACK_SPECIALTIES = ["باطنة", "أطفال", "قلب", "صدر", "عظام", "جلدية", "نساء وتوليد", "أنف وأذن", "مخ وأعصاب", "سكر وغدد"];

export function gradesFor(serviceType: string | null | undefined): string[] {
  const s = serviceType ?? "";
  if (s.includes("تمريض")) return NURSE_GRADES;
  if (s.includes("أشعة")) return XRAY_TYPES;
  return DOCTOR_GRADES;
}

// A doctor needs grade + specialty; a nurse needs the grade; X-ray needs nothing extra.
export function missingProfessionalInfo(p: Pick<DbProvider, "service_type" | "grade" | "specialty">): string[] {
  const grades = gradesFor(p.service_type);
  const missing: string[] = [];
  if (grades.length && !(p.service_type ?? "").includes("أشعة") && !(p.grade && grades.includes(p.grade))) missing.push(gradeLabelFor(p.service_type));
  if ((p.service_type ?? "").includes("كشف") && !p.specialty) missing.push("التخصص");
  return missing;
}

// Used only when the admin did not define a range for the doctor's grade + specialty.
export const DEFAULT_VISIT_RANGE: Record<string, { min: number; max: number }> = {
  "أخصائي": { min: 200, max: 500 },
  "استشاري": { min: 400, max: 1000 },
};

type RangeRow = {
  price_min: number | null; price_max: number | null;
  price_min_specialist: number | null; price_max_specialist: number | null;
  price_min_consultant: number | null; price_max_consultant: number | null;
};

// Admin price range for a service row and a doctor grade (grade-specific first, then the generic one).
export function priceRangeFor(row: RangeRow | undefined | null, grade: string, fallback = true): { min: number; max: number } {
  const consultant = grade === "استشاري";
  const min = (consultant ? row?.price_min_consultant : row?.price_min_specialist) ?? row?.price_min ?? 0;
  const max = (consultant ? row?.price_max_consultant : row?.price_max_specialist) ?? row?.price_max ?? 0;
  if (max > 0 && max >= min) return { min, max };
  return fallback ? (DEFAULT_VISIT_RANGE[grade] ?? DEFAULT_VISIT_RANGE["أخصائي"]) : { min: 0, max: 0 };
}
