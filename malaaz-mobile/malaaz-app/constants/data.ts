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
export type PaymentMethod = "cash" | "vodafone_cash";

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
    description: "تحويل على رقم",
    icon: "cellphone",
    detail: "01039091989",
  },
];

// ─── Provider Type ────────────────────────────────────────────────────────────
export type ProviderService = {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
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
  bio: string;
  phone: string;
  avatar: ImageSourcePropType | { uri: string };
  available: boolean;
  responseTime: string;
  services: ProviderService[];
};

export function mapDbProviderToProvider(db: DbProvider): Provider {
  return {
    id: db.id,
    name: db.full_name,
    title: getProviderTitle(db.specialty),
    serviceType: db.specialty as ServiceType,
    rating: db.rating ?? 5.0,
    reviewsCount: db.reviews_count ?? 0,
    yearsExperience: db.experience_years ?? 1,
    city: db.coverage_areas?.[0] ?? "القاهرة",
    bio: db.bio ?? "",
    phone: db.phone,
    avatar: db.photo_url
      ? { uri: db.photo_url }
      : require("../assets/images/provider1.png"),
    available: db.available ?? true,
    responseTime: db.response_time ?? "خلال ساعة",
    services: getDefaultServices(db.specialty as ServiceType),
  };
}

function getProviderTitle(specialty: string): string {
  switch (specialty) {
    case "doctor": return "طبيب منزلي";
    case "nurse":  return "ممرض/ممرضة قانونية";
    case "xray":   return "أخصائي أشعة منزلية";
    default:       return "مقدم خدمة";
  }
}

function getDefaultServices(type: ServiceType): ProviderService[] {
  switch (type) {
    case "doctor":
      return [
        { id: "d1", name: "كشف عام شامل",         description: "فحص سريري كامل مع استشارة طبية", price: 350, durationMinutes: 45 },
        { id: "d2", name: "متابعة أمراض مزمنة",    description: "سكري، ضغط، قلب",                 price: 250, durationMinutes: 30 },
        { id: "d3", name: "كشف كبار السن",         description: "تقييم صحي شامل",                  price: 400, durationMinutes: 60 },
      ];
    case "nurse":
      return [
        { id: "n1", name: "تركيب محلول وريدي",     description: "حسب وصفة الطبيب",                 price: 200, durationMinutes: 60 },
        { id: "n2", name: "تغيير وعناية بالجروح",  description: "تنظيف وتغيير الضمادات",            price: 150, durationMinutes: 30 },
        { id: "n3", name: "حقن عضل / وريد",        description: "إعطاء الحقن بأمان",               price: 100, durationMinutes: 20 },
      ];
    case "xray":
      return [
        { id: "x1", name: "أشعة سينية للصدر",      description: "مع تقرير طبي معتمد",              price: 500, durationMinutes: 30 },
        { id: "x2", name: "سونار منزلي",           description: "بطن أو حمل بجهاز محمول",          price: 600, durationMinutes: 45 },
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
