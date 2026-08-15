import { ImageSourcePropType } from "react-native";
import { DbProvider } from "@/lib/supabase";

// ─── Service Types ────────────────────────────────────────────────────────────
export type ServiceType = "doctor" | "nurse" | "xray";

export type ServiceSubOption = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

export type ServiceCategory = {
  id: ServiceType;
  name: string;
  description: string;
  icon: string;
  subOptions: ServiceSubOption[];
};

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: "doctor",
    name: "كشف منزلي",
    description: "كشف طبي في منزلك",
    icon: "stethoscope",
    subOptions: [
      { id: "doctor_general",  name: "كشف عام",            description: "فحص سريري شامل واستشارة طبية",       icon: "medical-bag" },
      { id: "doctor_chronic",  name: "أمراض مزمنة",        description: "سكري، ضغط، قلب، كلى",               icon: "heart-pulse" },
      { id: "doctor_child",    name: "طب أطفال",            description: "فحص وعلاج الأطفال منزلياً",         icon: "baby-face" },
      { id: "doctor_elderly",  name: "رعاية كبار السن",    description: "تقييم صحي شامل لكبار السن",          icon: "human-cane" },
      { id: "doctor_followup", name: "متابعة بعد عملية",   description: "متابعة الحالة بعد الخروج من المستشفى", icon: "clipboard-pulse" },
    ],
  },
  {
    id: "nurse",
    name: "تمريض منزلي",
    description: "خدمات تمريض احترافية",
    icon: "heart-pulse",
    subOptions: [
      { id: "nurse_iv",        name: "محلول وريدي",         description: "تركيب وإدارة المحاليل الوريدية",     icon: "needle" },
      { id: "nurse_wound",     name: "عناية بالجروح",       description: "تنظيف وتغيير الضمادات",             icon: "bandage" },
      { id: "nurse_injection", name: "حقن وأدوية",          description: "حقن عضل أو وريد حسب الوصفة",        icon: "syringe" },
      { id: "nurse_catheter",  name: "قسطرة وأنابيب",       description: "تركيب ومتابعة القسطرة",             icon: "water" },
      { id: "nurse_care",      name: "رعاية مريض",          description: "رعاية شاملة للمريض في المنزل",      icon: "account-heart" },
    ],
  },
  {
    id: "xray",
    name: "أشعة منزلية",
    description: "تصوير أشعة في موقعك",
    icon: "radioactive",
    subOptions: [
      { id: "xray_chest",      name: "أشعة صدر",            description: "تصوير صدر مع تقرير طبي",            icon: "lungs" },
      { id: "xray_bones",      name: "أشعة عظام",           description: "كسور وإصابات الأطراف",              icon: "bone" },
      { id: "xray_ultrasound", name: "سونار",                description: "سونار بطن أو حمل بجهاز محمول",     icon: "waveform" },
      { id: "xray_ecg",        name: "رسم قلب ECG",         description: "تخطيط القلب الكهربائي",             icon: "heart-flash" },
    ],
  },
];

// ─── Payment Methods ──────────────────────────────────────────────────────────
export type PaymentMethod = "cash" | "vodafone_cash" | "instapay";

export const PAYMENT_METHODS = [
  {
    id: "cash" as PaymentMethod,
    name: "كاش",
    description: "الدفع نقداً عند الزيارة",
    icon: "cash",
    detail: null,
  },
  {
    id: "vodafone_cash" as PaymentMethod,
    name: "محفظة فودافون",
    description: "حوّل على المحفظة الرسمية وأظهر لقطة الشاشة لمقدم الخدمة —",
    icon: "cellphone",
    detail: process.env.EXPO_PUBLIC_VODAFONE_CASH ?? "01039091989",
  },
  {
    id: "instapay" as PaymentMethod,
    name: "إنستاباي",
    description: "سيتواصل معك فريقنا على واتساب لإتمام التحويل 💬",
    icon: "contactless-payment",
    detail: null,
  },
];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "كاش",
  vodafone_cash: "محفظة فودافون",
  instapay: "إنستاباي",
};

// ─── فترات المواعيد (مطابقة للموقع) ─────────────────────────────────────────
export const TIME_PERIODS = [
  "أسرع وقت ممكن",
  "صباحاً (8 - 12)",
  "ظهراً (12 - 4)",
  "مساءً (4 - 9)",
];

// ─── Provider Type ────────────────────────────────────────────────────────────
export type ProviderService = {
  id: string;
  name: string;
  description: string;
  price: number;
  durationLabel: string;
};

export type Provider = {
  id: string;
  name: string;
  title: string;
  serviceType: ServiceType;
  rating: number;
  reviewsCount: number;
  yearsExperience: number;
  city: string;
  areas: string[];
  bio: string;
  phone: string;
  avatar: ImageSourcePropType | { uri: string };
  available: boolean;
  responseTime: string;
  services: ProviderService[];
};

// service_type في القاعدة مخزّن بالاسم العربي
export function serviceTypeFromArabic(name: string | null): ServiceType {
  if (!name) return "doctor";
  if (name.includes("تمريض")) return "nurse";
  if (name.includes("أشعة") || name.includes("اشعة")) return "xray";
  return "doctor";
}

export function serviceTypeToArabic(type: ServiceType): string {
  return getCategoryById(type)?.name ?? "كشف منزلي";
}

export function mapDbProviderToProvider(db: DbProvider): Provider {
  const serviceType = serviceTypeFromArabic(db.service_type);
  const areasList = (db.areas ?? db.area ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  return {
    id: db.id,
    name: db.name,
    title: getProviderTitle(serviceType, db.grade, db.specialty),
    serviceType,
    rating: toNumber(db.rating) ?? 5.0,
    reviewsCount: 0,
    yearsExperience: toNumber(db.experience) ?? 1,
    city: db.area ?? areasList[0] ?? "القاهرة",
    areas: areasList,
    bio: db.bio ?? "",
    phone: db.phone ?? "",
    avatar: db.photo_url
      ? { uri: db.photo_url }
      : require("../assets/images/provider1.png"),
    available: db.is_available ?? false,
    responseTime: "خلال ساعة",
    services: getDefaultServices(serviceType, toNumber(db.price)),
  };
}

function toNumber(v: string | number | null | undefined): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

function getProviderTitle(
  type: ServiceType,
  grade: string | null,
  specialty: string | null
): string {
  const parts = [grade, specialty].filter(Boolean);
  if (parts.length) return parts.join(" ");
  switch (type) {
    case "doctor": return "طبيب منزلي";
    case "nurse":  return "ممرض/ممرضة قانونية";
    case "xray":   return "أخصائي أشعة منزلية";
    default:       return "مقدم خدمة";
  }
}

function getDefaultServices(type: ServiceType, basePrice?: number): ProviderService[] {
  switch (type) {
    case "doctor":
      return [
        { id: "d1", name: "كشف عام شامل",         description: "فحص سريري كامل مع استشارة طبية", price: basePrice ?? 350, durationLabel: "45 دقيقة" },
        { id: "d2", name: "متابعة أمراض مزمنة",    description: "سكري، ضغط، قلب",                 price: basePrice ?? 250, durationLabel: "30 دقيقة" },
        { id: "d3", name: "كشف كبار السن",         description: "تقييم صحي شامل",                  price: basePrice ?? 400, durationLabel: "60 دقيقة" },
      ];
    case "nurse":
      return [
        { id: "n1", name: "تركيب محلول وريدي",     description: "حسب وصفة الطبيب",                 price: basePrice ?? 200, durationLabel: "60 دقيقة" },
        { id: "n2", name: "تغيير وعناية بالجروح",  description: "تنظيف وتغيير الضمادات",            price: basePrice ?? 150, durationLabel: "30 دقيقة" },
        { id: "n3", name: "حقن عضل / وريد",        description: "إعطاء الحقن بأمان",               price: basePrice ?? 100, durationLabel: "20 دقيقة" },
      ];
    case "xray":
      return [
        { id: "x1", name: "أشعة سينية للصدر",      description: "مع تقرير طبي معتمد",              price: basePrice ?? 500, durationLabel: "30 دقيقة" },
        { id: "x2", name: "سونار منزلي",           description: "بطن أو حمل بجهاز محمول",          price: basePrice ?? 600, durationLabel: "45 دقيقة" },
      ];
  }
}

// ─── Areas ────────────────────────────────────────────────────────────────────
export const CAIRO_AREAS = [
  "مدينة نصر", "المعادي", "الزيتون", "شبرا", "المطرية", "عين شمس",
  "حلوان", "المقطم", "التجمع الأول", "التجمع الخامس", "القاهرة الجديدة",
  "مصر الجديدة", "الزمالك", "وسط البلد", "العباسية", "بولاق",
  "السيدة زينب", "المنيل", "أميرية", "الشروق", "بدر",
  "العبور", "15 مايو", "حدائق القبة", "الساحل", "روض الفرج",
];

export const GIZA_AREAS = [
  "الهرم", "الدقي", "العجوزة", "المهندسين", "إمبابة", "بولاق الدكرور",
  "فيصل", "أكتوبر", "الشيخ زايد", "الوراق", "كرداسة",
  "أبو النمرس", "البدرشين", "أوسيم", "الطالبية", "أرض اللواء",
  "شبرامنت", "الحوامدية", "البراجيل",
];

export const ALL_CITIES = ["القاهرة", "الجيزة"];

export function getCategoryById(id: ServiceType): ServiceCategory | undefined {
  return SERVICE_CATEGORIES.find((c) => c.id === id);
}

// ─── مطابقة المدينة الذكية ────────────────────────────────────────────────────
// المقدمين بيكتبوا مناطقهم بصيغ مختلفة ("جيزه"، "6 أكتوبر"، "التجمع الأول"...)
// فبنطبّع النص وبنستعين بجدول مناطق التغطية عشان نعرف منطقة دي تبع أنهي مدينة

function normalizeArabic(s: string): string {
  return s
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^ال/, "");
}

// بيرجع مجموعة المدن اللي المقدم بيخدم فيها — فاضية لو مش معروفة
export function providerCities(
  areas: string[],
  coverage: { name: string; city: string }[]
): Set<string> {
  const cities = new Set<string>();
  const cairoN = normalizeArabic("القاهرة");
  const gizaN = normalizeArabic("الجيزة");

  for (const raw of areas) {
    const na = normalizeArabic(raw);
    if (!na) continue;

    // ذكر المدينة نفسها في النص ("الجيزه والقاهره")
    if (na.includes(cairoN)) cities.add("القاهرة");
    if (na.includes(gizaN)) cities.add("الجيزة");

    // مطابقة مع مناطق التغطية المعروفة (بالاحتواء أو تقاطع الكلمات)
    const words = na.split(" ").filter((w) => w.length >= 3);
    for (const c of coverage) {
      const nc = normalizeArabic(c.name);
      const ncWords = nc.split(" ").filter((w) => w.length >= 3);
      const hit =
        nc === na ||
        na.includes(nc) ||
        nc.includes(na) ||
        words.some((w) => ncWords.includes(w));
      if (hit) {
        const cityN = normalizeArabic(c.city);
        if (cityN === cairoN) cities.add("القاهرة");
        else if (cityN === gizaN) cities.add("الجيزة");
      }
    }
  }
  return cities;
}
