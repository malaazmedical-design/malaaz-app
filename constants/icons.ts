// أيقونة مميزة لكل تخصص/خدمة حسب الكلمات المفتاحية في اسمها — بهوية ملاذ
// fallback آمن لو الاسم جديد ومفيش له مطابقة

type IconName = string;

const RULES: { keywords: string[]; icon: IconName }[] = [
  // تخصصات الكشف المنزلي
  { keywords: ["مخ", "أعصاب", "اعصاب", "عصب"], icon: "brain" },
  { keywords: ["قلب", "أوعية", "اوعية"], icon: "heart-pulse" },
  { keywords: ["عظام", "عظم", "مفاصل", "روماتيزم"], icon: "bone" },
  { keywords: ["أطفال", "اطفال", "حديثي"], icon: "baby-face-outline" },
  { keywords: ["نساء", "توليد", "حمل"], icon: "human-pregnant" },
  { keywords: ["باطنة", "باطنه", "جهاز هضمي", "هضمي", "كبد"], icon: "stomach" },
  { keywords: ["صدر", "تنفس", "رئة", "حساسية صدر"], icon: "lungs" },
  { keywords: ["أنف", "انف", "أذن", "اذن", "حنجرة"], icon: "ear-hearing" },
  { keywords: ["عيون", "رمد", "عين"], icon: "eye-outline" },
  { keywords: ["أسنان", "اسنان", "سن"], icon: "tooth-outline" },
  { keywords: ["جلدية", "جلديه", "جلد", "تجميل"], icon: "face-man-shimmer-outline" },
  { keywords: ["نفسي", "نفسية", "نفسيه"], icon: "head-heart-outline" },
  { keywords: ["مسالك", "بولية", "بوليه", "كلى", "كلي"], icon: "water-outline" },
  { keywords: ["سكر", "غدد", "سمنة", "تغذية", "تغذيه"], icon: "food-apple-outline" },
  { keywords: ["مزمنة", "مزمنه", "ضغط"], icon: "clipboard-pulse-outline" },
  { keywords: ["كبار السن", "مسنين", "شيخوخة"], icon: "human-cane" },
  { keywords: ["عام", "أسرة", "اسرة", "ممارس"], icon: "medical-bag" },
  { keywords: ["جراحة", "جراحه"], icon: "content-cut" },
  { keywords: ["علاج طبيعي", "تأهيل"], icon: "human-handsup" },

  // التمريض المنزلي
  { keywords: ["محلول", "وريد"], icon: "iv-bag" },
  { keywords: ["جروح", "جرح", "غيار", "ضماد", "قرح"], icon: "bandage" },
  { keywords: ["حقن", "حقنة", "إبر", "ابر"], icon: "needle" },
  { keywords: ["قسطرة", "قسطره", "أنابيب", "انابيب", "أنبوبة"], icon: "pipe" },
  { keywords: ["إقامة", "اقامة", "ساعة", "رعاية مريض", "مرافقة"], icon: "bed-clock" },
  { keywords: ["سريعة", "سريع", "طوارئ", "عاجل"], icon: "lightning-bolt" },
  { keywords: ["ضغط وسكر", "قياس"], icon: "gauge" },
  { keywords: ["أكسجين", "اكسجين", "تنفس صناعي"], icon: "gas-cylinder" },

  // الأشعة المنزلية
  { keywords: ["x-ray", "سينية", "عادية", "أشعة عاد"], icon: "radiology-box-outline" },
  { keywords: ["سونار", "موجات", "بطن وحوض"], icon: "waveform" },
  { keywords: ["إيكو", "ايكو", "قلب (إيكو"], icon: "heart-flash" },
  { keywords: ["دوبلر", "دوبلكس", "شرايين", "أوردة", "اوردة"], icon: "pulse" },
  { keywords: ["رسم قلب", "ecg", "تخطيط"], icon: "chart-line-variant" },
  { keywords: ["رنين", "مقطعية"], icon: "magnet" },
  { keywords: ["تحاليل", "معمل", "عينة", "عينات"], icon: "test-tube" },
];

export function serviceIcon(name: string): IconName {
  const n = (name || "").toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => n.includes(k))) return rule.icon;
  }
  return "stethoscope";
}
