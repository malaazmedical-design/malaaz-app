export type MizoWord = {
  id: string;
  label: string;
  emoji: string;
  phrase: string; // الجملة اللي بتتقال
  children?: MizoWord[]; // مستوى ثاني اختياري
};

export type MizoCategory = {
  id: string;
  label: string;
  emoji: string;
  words: MizoWord[];
};

export const MIZO_CATEGORIES: MizoCategory[] = [
  {
    id: "basic",
    label: "أساسي",
    emoji: "⭐",
    words: [
      { id: "eat",      label: "آكل",     emoji: "🍽️", phrase: "أنا عايز آكل" },
      { id: "water",    label: "مية",     emoji: "💧", phrase: "أنا عايز مية" },
      { id: "no",       label: "مش عايز", emoji: "🚫", phrase: "أنا مش عايز" },
      { id: "yes",      label: "عايز",    emoji: "✋", phrase: "أنا عايز" },
      { id: "sleep",    label: "أنام",    emoji: "🛏️", phrase: "أنا عايز أنام" },
      { id: "bathroom", label: "الحمام",  emoji: "🚾", phrase: "محتاج الحمام" },
      { id: "medicine", label: "الدوا",   emoji: "💊", phrase: "محتاج الدوا" },
      { id: "tea",      label: "شاي",     emoji: "☕", phrase: "أنا عايز شاي" },
      { id: "dress",    label: "البس",    emoji: "👕", phrase: "عايز أتلبس" },
      { id: "sit",      label: "أقعد",    emoji: "🪑", phrase: "عايز أقعد" },
      { id: "stand",    label: "أقوم",    emoji: "🧍", phrase: "عايز أقوم" },
      { id: "tv",       label: "التلفزيون", emoji: "📺", phrase: "عايز أشوف التلفزيون" },
    ],
  },
  {
    id: "health",
    label: "صحة",
    emoji: "❤️",
    words: [
      { id: "pain",      label: "وجعني",   emoji: "😣", phrase: "أنا وجعني" },
      { id: "tired",     label: "تعبان",   emoji: "😓", phrase: "أنا تعبان" },
      { id: "dizzy",     label: "دايخ",    emoji: "😵", phrase: "أنا حاسس بدوخة" },
      { id: "cold",      label: "بردان",   emoji: "🥶", phrase: "أنا بردان" },
      { id: "hot",       label: "حران",    emoji: "🥵", phrase: "أنا حران" },
      { id: "nausea",    label: "غثيان",   emoji: "🤢", phrase: "أنا حاسس بغثيان" },
      { id: "breathe",   label: "صعوبة تنفس", emoji: "😮‍💨", phrase: "عندي صعوبة في التنفس" },
      { id: "good",      label: "كويس",    emoji: "😊", phrase: "أنا كويس الحمد لله" },
    ],
  },
  {
    id: "family",
    label: "العيلة",
    emoji: "👨‍👩‍👧",
    words: [
      { id: "call_son",    label: "ابني",   emoji: "👦", phrase: "نادوا على ابني" },
      { id: "call_daughter", label: "بنتي", emoji: "👧", phrase: "نادوا على بنتي" },
      { id: "call_wife",   label: "مراتي",  emoji: "👩", phrase: "نادوا على مراتي" },
      { id: "call_husband", label: "جوزي", emoji: "👨", phrase: "نادوا على جوزي" },
      { id: "call_nurse",  label: "الممرض", emoji: "👩‍⚕️", phrase: "نادوا على الممرض" },
      { id: "call_doctor", label: "الدكتور", emoji: "🩺", phrase: "عايز أشوف الدكتور" },
    ],
  },
  {
    id: "feelings",
    label: "مشاعر",
    emoji: "😊",
    words: [
      { id: "happy",   label: "مبسوط",  emoji: "😄", phrase: "أنا مبسوط" },
      { id: "sad",     label: "زعلان",  emoji: "😢", phrase: "أنا زعلان" },
      { id: "scared",  label: "خايف",   emoji: "😨", phrase: "أنا خايف" },
      { id: "bored",   label: "ملول",   emoji: "😒", phrase: "أنا زهقت" },
      { id: "lonely",  label: "وحيد",   emoji: "🥺", phrase: "أنا حاسس إني وحيد" },
      { id: "thanks",  label: "شكراً",  emoji: "🙏", phrase: "شكراً جزيلاً" },
    ],
  },
  {
    id: "responses",
    label: "ردود",
    emoji: "👍",
    words: [
      { id: "yes_resp",    label: "ايوه",      emoji: "✅", phrase: "ايوه" },
      { id: "no_resp",     label: "لأ",        emoji: "❌", phrase: "لأ" },
      { id: "maybe",       label: "ممكن",      emoji: "🤔", phrase: "ممكن" },
      { id: "wait",        label: "استنى",     emoji: "✋", phrase: "استنى شوية" },
      { id: "repeat",      label: "تاني",      emoji: "🔁", phrase: "قول تاني" },
      { id: "understand",  label: "فاهم",      emoji: "👍", phrase: "أيوه فاهم" },
      { id: "not_understand", label: "مش فاهم", emoji: "❓", phrase: "مش فاهم" },
      { id: "more",        label: "أكتر",      emoji: "➕", phrase: "عايز أكتر" },
      { id: "enough",      label: "كفاية",     emoji: "🛑", phrase: "كفاية" },
    ],
  },
];
