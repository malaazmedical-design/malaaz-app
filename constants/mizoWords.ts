export type MizoWord = {
  id: string;
  label: string;
  emoji: string;
  phrase: string;
  children?: MizoWord[];
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
      { id: "eat",      label: "آكل",       emoji: "🍽️", phrase: "أنا عايز آكل" },
      { id: "water",    label: "مية",        emoji: "🥤",  phrase: "أنا عايز مية" },
      { id: "tea",      label: "شاي",        emoji: "☕",  phrase: "أنا عايز شاي" },
      { id: "coffee",   label: "قهوة",       emoji: "🫖",  phrase: "أنا عايز قهوة" },
      { id: "bathroom", label: "الحمام",     emoji: "🚽",  phrase: "محتاج الحمام" },
      { id: "sleep",    label: "أنام",       emoji: "🛏️", phrase: "أنا عايز أنام" },
      { id: "medicine", label: "الدوا",      emoji: "💊",  phrase: "محتاج الدوا" },
      { id: "dress",    label: "البس",       emoji: "👕",  phrase: "عايز أتلبس" },
      { id: "sit",      label: "أقعد",       emoji: "🪑",  phrase: "عايز أقعد" },
      { id: "stand",    label: "أقوم",       emoji: "🧍",  phrase: "عايز أقوم" },
      { id: "tv",       label: "التلفزيون",  emoji: "📺",  phrase: "عايز أشوف التلفزيون" },
      { id: "mobile",   label: "الموبايل",   emoji: "📱",  phrase: "عايز الموبايل" },
      { id: "go_out",   label: "أخرج",       emoji: "🚪",  phrase: "عايز أخرج" },
      { id: "no",       label: "مش عايز",    emoji: "🙅",  phrase: "أنا مش عايز" },
      { id: "yes",      label: "عايز",       emoji: "✋",  phrase: "أنا عايز" },
      { id: "cold_feel",label: "بردان",      emoji: "🥶",  phrase: "أنا بردان" },
      { id: "hot_feel", label: "حران",       emoji: "🥵",  phrase: "أنا حران" },
      { id: "injection",label: "حقنة",       emoji: "💉",  phrase: "محتاج حقنة" },
    ],
  },
  {
    id: "health",
    label: "صحة",
    emoji: "❤️",
    words: [
      { id: "pain",       label: "وجعني",         emoji: "😣",   phrase: "أنا وجعني" },
      { id: "head_pain",  label: "راسي",           emoji: "🤕",   phrase: "راسي بيوجعني" },
      { id: "belly_pain", label: "بطني",           emoji: "🫃",   phrase: "بطني بتوجعني" },
      { id: "back_pain",  label: "ضهري",           emoji: "🪑",   phrase: "ضهري بيوجعني" },
      { id: "chest_pain", label: "صدري",           emoji: "💔",   phrase: "صدري بيوجعني" },
      { id: "tired",      label: "تعبان",          emoji: "😓",   phrase: "أنا تعبان" },
      { id: "dizzy",      label: "دايخ",           emoji: "😵",   phrase: "أنا حاسس بدوخة" },
      { id: "nausea",     label: "غثيان",          emoji: "🤢",   phrase: "أنا حاسس بغثيان" },
      { id: "breathe",    label: "صعوبة تنفس",     emoji: "😮‍💨", phrase: "عندي صعوبة في التنفس" },
      { id: "good",       label: "كويس",           emoji: "😊",   phrase: "أنا كويس الحمد لله" },
      { id: "wound",      label: "جرح",            emoji: "🩹",   phrase: "عندي جرح" },
      { id: "pressure",   label: "قياس الضغط",     emoji: "🩺",   phrase: "عايز أقيس الضغط" },
      { id: "doctor",     label: "الدكتور",        emoji: "👨‍⚕️", phrase: "عايز أشوف الدكتور" },
      { id: "cant_move",  label: "مش قادر أتحرك", emoji: "🦽",   phrase: "مش قادر أتحرك" },
      { id: "pain_strong",label: "وجع شديد",       emoji: "🔴",   phrase: "الوجع شديد جداً" },
      { id: "fever",      label: "حرارة",          emoji: "🌡️",  phrase: "عندي حرارة" },
    ],
  },
  {
    id: "family",
    label: "العيلة",
    emoji: "👨‍👩‍👧",
    words: [
      { id: "call_mama",     label: "ماما",     emoji: "👩",    phrase: "نادوا على ماما" },
      { id: "call_baba",     label: "بابا",     emoji: "👨",    phrase: "نادوا على بابا" },
      { id: "call_son",      label: "ابني",     emoji: "👦",    phrase: "نادوا على ابني" },
      { id: "call_daughter", label: "بنتي",     emoji: "👧",    phrase: "نادوا على بنتي" },
      { id: "call_wife",     label: "مراتي",    emoji: "👩‍❤️‍👨", phrase: "نادوا على مراتي" },
      { id: "call_husband",  label: "جوزي",     emoji: "💑",    phrase: "نادوا على جوزي" },
      { id: "call_bro",      label: "أخويا",    emoji: "🧑",    phrase: "نادوا على أخويا" },
      { id: "call_sis",      label: "أختي",     emoji: "👩‍👧",  phrase: "نادوا على أختي" },
      { id: "call_grandpa",  label: "جدي",      emoji: "👴",    phrase: "نادوا على جدي" },
      { id: "call_grandma",  label: "جدتي",     emoji: "👵",    phrase: "نادوا على جدتي" },
      { id: "call_nurse",    label: "الممرض",   emoji: "👩‍⚕️",  phrase: "نادوا على الممرض" },
      { id: "call_doctor",   label: "الدكتور",  emoji: "🩺",    phrase: "عايز أشوف الدكتور" },
      { id: "alone",         label: "وحيد",     emoji: "🥺",    phrase: "أنا وحيد عايز حد جنبي" },
    ],
  },
  {
    id: "feelings",
    label: "مشاعر",
    emoji: "😊",
    words: [
      { id: "happy",    label: "مبسوط",     emoji: "😄",  phrase: "أنا مبسوط" },
      { id: "sad",      label: "زعلان",     emoji: "😢",  phrase: "أنا زعلان" },
      { id: "scared",   label: "خايف",      emoji: "😨",  phrase: "أنا خايف" },
      { id: "worried",  label: "قلقان",     emoji: "😰",  phrase: "أنا قلقان" },
      { id: "angry",    label: "زعلان قوي", emoji: "😠",  phrase: "أنا زعلان جداً" },
      { id: "calm",     label: "مرتاح",     emoji: "😌",  phrase: "أنا مرتاح" },
      { id: "bored",    label: "زهقت",      emoji: "😩",  phrase: "أنا زهقت" },
      { id: "lonely",   label: "وحيد",      emoji: "🥺",  phrase: "أنا حاسس إني وحيد" },
      { id: "hug",      label: "عايز حضن",  emoji: "🤗",  phrase: "عايز حضن" },
      { id: "cant",     label: "مش قادر",   emoji: "😞",  phrase: "أنا مش قادر" },
      { id: "hope",     label: "عندي أمل",  emoji: "🌟",  phrase: "عندي أمل وهكمل" },
      { id: "thanks",   label: "شكراً",     emoji: "🙏",  phrase: "شكراً جزيلاً" },
      { id: "love",     label: "بحبك",      emoji: "❤️",  phrase: "أنا بحبك" },
    ],
  },
  {
    id: "responses",
    label: "ردود",
    emoji: "👍",
    words: [
      { id: "yes_resp",     label: "ايوه",       emoji: "✅",  phrase: "ايوه" },
      { id: "no_resp",      label: "لأ",          emoji: "❌",  phrase: "لأ" },
      { id: "maybe",        label: "ممكن",        emoji: "🤔",  phrase: "ممكن" },
      { id: "wait",         label: "استنى",       emoji: "✋",  phrase: "استنى شوية" },
      { id: "repeat",       label: "تاني",        emoji: "🔁",  phrase: "قول تاني" },
      { id: "slow",         label: "ببطء",        emoji: "🐢",  phrase: "ببطء من فضلك" },
      { id: "understand",   label: "فاهم",        emoji: "👌",  phrase: "أيوه فاهم" },
      { id: "not_understand",label: "مش فاهم",   emoji: "❓",  phrase: "مش فاهم" },
      { id: "correct",      label: "صح",          emoji: "✔️",  phrase: "ده صح" },
      { id: "wrong",        label: "غلط",         emoji: "✖️",  phrase: "ده غلط" },
      { id: "more",         label: "أكتر",        emoji: "➕",  phrase: "عايز أكتر" },
      { id: "enough",       label: "كفاية",       emoji: "🛑",  phrase: "كفاية" },
      { id: "good_resp",    label: "تمام",        emoji: "👍",  phrase: "تمام" },
      { id: "not_sure",     label: "مش عارف",     emoji: "🤷",  phrase: "مش عارف" },
    ],
  },
];
