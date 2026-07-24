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
  // ─── 1. أساسي ─────────────────────────────────────────────────────────────
  {
    id: "basic",
    label: "أساسي",
    emoji: "⭐",
    words: [
      { id: "eat",         label: "آكل",          emoji: "🍽️",  phrase: "أنا عايز آكل" },
      { id: "water",       label: "مية",           emoji: "💧",   phrase: "أنا عايز مية" },
      { id: "tea",         label: "شاي",           emoji: "☕",   phrase: "أنا عايز شاي" },
      { id: "bathroom",    label: "الحمام",        emoji: "🚽",   phrase: "محتاج الحمام" },
      { id: "sleep",       label: "أنام",          emoji: "🛏️",  phrase: "أنا عايز أنام" },
      { id: "medicine",    label: "الدوا",         emoji: "💊",   phrase: "محتاج الدوا" },
      { id: "pain",        label: "وجعني",         emoji: "😣",   phrase: "أنا وجعني" },
      { id: "doctor",      label: "الدكتور",       emoji: "👨‍⚕️", phrase: "عايز أشوف الدكتور" },
      { id: "sit",         label: "أقعد",          emoji: "🪑",   phrase: "عايز أقعد" },
      { id: "lie_down",    label: "أتمدد",         emoji: "🛌",   phrase: "عايز أتمدد" },
      { id: "cold_feel",     label: "بردان",          emoji: "🥶",   phrase: "أنا بردان" },
      { id: "hot_feel",      label: "حران",           emoji: "🥵",   phrase: "أنا حران" },
      { id: "very_thirsty",  label: "عطشان جداً",    emoji: "😫",   phrase: "أنا عطشان جداً" },
    ],
  },

  // ─── 2. أكل وشرب ──────────────────────────────────────────────────────────
  {
    id: "food_drink",
    label: "أكل وشرب",
    emoji: "🍽️",
    words: [
      {
        id: "water_det",   label: "مية",           emoji: "💧",   phrase: "أنا عايز مية",
        children: [
          { id: "water_cold",   label: "ساقعة",      emoji: "🧊",  phrase: "عايز مية ساقعة" },
          { id: "water_warm",   label: "دافية",      emoji: "♨️",  phrase: "عايز مية دافية" },
          { id: "water_straw",  label: "بالقشة",     emoji: "🥤",  phrase: "عايز أشرب بالقشة" },
          { id: "water_close",  label: "جنبي",       emoji: "🤏",  phrase: "هات المية جنبي أنا مش قادر أوصالها" },
        ],
      },
      {
        id: "hungry",      label: "جعان",          emoji: "🍽️",   phrase: "أنا جعان عايز آكل",
        children: [
          { id: "food_light",   label: "حاجة خفيفة", emoji: "🥣",  phrase: "عايز حاجة خفيفة" },
          { id: "food_soup",    label: "شوربة",       emoji: "🍲",  phrase: "عايز شوربة" },
          { id: "food_yogurt",  label: "زبادي",       emoji: "🥛",  phrase: "عايز زبادي" },
          { id: "food_fruit",   label: "فاكهة",       emoji: "🍊",  phrase: "عايز فاكهة" },
        ],
      },
      { id: "full",        label: "شبعت",          emoji: "🙏",   phrase: "شبعت مش قادر أكمل" },
      { id: "food_hot",    label: "الأكل سخن",     emoji: "🔥",   phrase: "الأكل سخن أوي خليه يبرد شوية" },
      { id: "food_cold",   label: "الأكل بارد",    emoji: "❄️",   phrase: "الأكل بارد" },
      { id: "cut_food",    label: "قطّع الأكل",    emoji: "✂️",   phrase: "قطعلي الأكل وصغر اللقمة من فضلك" },
      { id: "cant_swallow",label: "مش قادر أبلع",  emoji: "🚫",   phrase: "أنا مش قادر أبلع" },
      { id: "no_more_food",  label: "مش عايز أكل",   emoji: "🙅",   phrase: "أنا مش عايز أكل دلوقتي" },
      { id: "tea_det",       label: "شاي",           emoji: "☕",   phrase: "أنا عايز شاي" },
      { id: "coffee_det",    label: "قهوة",          emoji: "☕",   phrase: "أنا عايز قهوة" },
      { id: "anise",         label: "يانسون",        emoji: "🌿",   phrase: "أنا عايز يانسون" },
      { id: "juice",         label: "عصير",          emoji: "🧃",   phrase: "أنا عايز عصير" },
      { id: "milk_fd",       label: "لبن",           emoji: "🥛",   phrase: "عايز لبن" },
      { id: "dates_fd",      label: "تمر",           emoji: "🌴",   phrase: "عايز تمر" },
      { id: "foul_fd",       label: "فول",           emoji: "🫘",   phrase: "عايز فول" },
      { id: "egg_fd",        label: "بيضة",          emoji: "🥚",   phrase: "عايز بيضة مسلوقة" },
      { id: "biscuit_fd",    label: "بسكويت",        emoji: "🍪",   phrase: "عايز بسكويت" },
      { id: "spoon_eat",     label: "آكل بالملعقة",  emoji: "🥄",   phrase: "عايز آكل لوحدي بالملعقة" },
      { id: "salty_food",    label: "الأكل مالح",    emoji: "🧂",   phrase: "الأكل مالح أوي" },
      { id: "not_hungry",    label: "مش جعان",       emoji: "🙅‍♂️", phrase: "مش جعان مش عايز آكل" },
    ],
  },

  // ─── 3. راحة وبيئة ────────────────────────────────────────────────────────
  {
    id: "comfort",
    label: "راحة",
    emoji: "🛋️",
    words: [
      { id: "sit_up",      label: "أقعد",          emoji: "🪑",   phrase: "عايز أقعد" },
      { id: "lie_d",       label: "أتمدد",         emoji: "🛌",   phrase: "عايز أتمدد" },
      { id: "pillow_up",   label: "ارفع المخدة",   emoji: "⬆️",   phrase: "ارفع المخدة من فضلك" },
      { id: "pillow_down", label: "نزل المخدة",    emoji: "⬇️",   phrase: "نزل المخدة من فضلك" },
      {
        id: "turn",        label: "أتقلب",         emoji: "🔄",   phrase: "عايز أتقلب",
        children: [
          { id: "turn_right", label: "على يمين",   emoji: "➡️",  phrase: "عايز أتقلب على يميني" },
          { id: "turn_left",  label: "على شمال",   emoji: "⬅️",  phrase: "عايز أتقلب على شمالي" },
        ],
      },
      { id: "back_hurt",   label: "ظهري وجعني",   emoji: "🪑",   phrase: "ظهري بيوجعني من القعدة" },
      { id: "help_stand",  label: "ساعدني أقف",   emoji: "🧍",   phrase: "ساعدني أقف من فضلك" },
      { id: "fix_legs",    label: "عدلي رجلي",    emoji: "🦵",   phrase: "عدلي رجلي من فضلك" },
      {
        id: "hot_env",     label: "حران / كيف",   emoji: "🌡️",  phrase: "أنا حران",
        children: [
          { id: "ac_on",      label: "التكييف",    emoji: "❄️",  phrase: "شغل التكييف من فضلك" },
          { id: "fan_on",     label: "المروحة",    emoji: "💨",  phrase: "شغل المروحة من فضلك" },
        ],
      },
      {
        id: "cold_env",    label: "بردان / غطا",  emoji: "🥶",   phrase: "أنا بردان غطيني",
        children: [
          { id: "cover_light",  label: "غطا خفيف",  emoji: "🌬️",  phrase: "غطيني بغطا خفيف" },
          { id: "cover_heavy",  label: "غطا تقيل",  emoji: "🛏️",  phrase: "عايز غطا تقيل" },
        ],
      },
      { id: "light_off",   label: "اقفل النور",   emoji: "🌙",   phrase: "اقفل النور من فضلك النور ضارب في عيني" },
      { id: "light_on",    label: "افتح النور",   emoji: "☀️",   phrase: "افتح النور من فضلك" },
      { id: "window_open", label: "افتح الشباك",  emoji: "🪟",   phrase: "افتح الشباك من فضلك" },
      { id: "window_close",label: "اقفل الشباك",  emoji: "🚪",   phrase: "اقفل الشباك من فضلك" },
      { id: "tv_on",       label: "شغل التلفزيون",emoji: "📺",   phrase: "شغل التلفزيون من فضلك" },
      { id: "tv_up",       label: "علي الصوت",    emoji: "🔊",   phrase: "علي صوت التلفزيون" },
      { id: "tv_down",     label: "هدي الصوت",    emoji: "🔈",   phrase: "هدي صوت التلفزيون" },
      { id: "tv_channel",  label: "غير القناة",   emoji: "📡",   phrase: "غير القناة من فضلك" },
      { id: "quran",       label: "قرآن",          emoji: "📿",   phrase: "عايز أسمع قرآن" },
      { id: "radio",       label: "راديو",         emoji: "📻",   phrase: "عايز أسمع راديو" },
      { id: "get_mobile",    label: "الموبايل",      emoji: "📱",   phrase: "هات لي الموبايل من فضلك" },
      { id: "glasses",       label: "النظارة",       emoji: "👓",   phrase: "هات لي النظارة من فضلك" },
      { id: "charge_phone",  label: "شحن الموبايل",  emoji: "🔌",   phrase: "حط الموبايل على الشاحن" },
      { id: "read_to_me",    label: "اقرألي",         emoji: "📖",   phrase: "ممكن تقرألي من الكتاب شوية" },
      { id: "ac_on_s",       label: "افتح التكييف",   emoji: "❄️",   phrase: "من فضلك شغل التكييف" },
      { id: "ac_off_s",      label: "اقفل التكييف",   emoji: "🌡️",  phrase: "من فضلك اقفل التكييف" },
    ],
  },

  // ─── 4. نظافة ──────────────────────────────────────────────────────────────
  {
    id: "hygiene",
    label: "نظافة",
    emoji: "🚿",
    words: [
      { id: "bathroom_hy", label: "الحمام",        emoji: "🚽",   phrase: "محتاج الحمام ضروري" },
      {
        id: "change",      label: "عايز أغير",     emoji: "👕",   phrase: "عايز أغير",
        children: [
          { id: "change_clothes", label: "ملابس",   emoji: "👕",  phrase: "عايز أغير ملابسي" },
          { id: "change_diaper",  label: "بامبرز",  emoji: "🩲",  phrase: "محتاج أغير البامبرز" },
        ],
      },
      { id: "wash_face",   label: "أغسل وشي",      emoji: "🫧",   phrase: "عايز أغسل وشي" },
      { id: "wash_teeth",  label: "أغسل أسناني",   emoji: "🦷",   phrase: "عايز أغسل أسناني" },
      { id: "wash_hands",  label: "أغسل إيدي",     emoji: "🤲",   phrase: "عايز أغسل إيدي" },
      { id: "shower",      label: "أستحمى",         emoji: "🚿",   phrase: "عايز أستحمى" },
      { id: "tissue",      label: "منديل",          emoji: "🧻",   phrase: "هات لي منديل من فضلك" },
      { id: "towel",       label: "فوطة",           emoji: "🪣",   phrase: "هات لي فوطة من فضلك" },
      { id: "dry_mouth",   label: "ريقي ناشف",      emoji: "👅",   phrase: "ريقي ناشف عايز أبل شفايفي" },
      { id: "bed_clean",   label: "نضف السرير",     emoji: "🛏️",  phrase: "السرير محتاج ينضف" },
    ],
  },

  // ─── 5. صحة ───────────────────────────────────────────────────────────────
  {
    id: "health",
    label: "صحة",
    emoji: "❤️",
    words: [
      { id: "pain_gen",    label: "وجعني",          emoji: "😣",   phrase: "أنا وجعني" },
      { id: "pain_str",    label: "وجع شديد",       emoji: "🔴",   phrase: "الوجع شديد جداً" },
      { id: "head_pain",   label: "راسي",            emoji: "🤕",   phrase: "راسي بيوجعني" },
      { id: "belly_pain",  label: "بطني",            emoji: "🫃",   phrase: "بطني بتوجعني" },
      { id: "back_pain",   label: "ضهري",            emoji: "🪑",   phrase: "ضهري بيوجعني" },
      { id: "chest_pain",  label: "صدري",            emoji: "💔",   phrase: "صدري بيوجعني" },
      { id: "good_h",      label: "كويس",            emoji: "😊",   phrase: "أنا كويس الحمد لله" },
      { id: "tired_h",     label: "تعبان",           emoji: "😓",   phrase: "أنا تعبان" },
      { id: "dizzy_h",     label: "دايخ",            emoji: "😵",   phrase: "أنا حاسس بدوخة" },
      { id: "nausea_h",    label: "غثيان",           emoji: "🤢",   phrase: "أنا حاسس بغثيان" },
      { id: "vomit",       label: "ترجيع",           emoji: "🤮",   phrase: "أنا هرجع خدوا البانيه" },
      { id: "breathe_h",   label: "صعوبة تنفس",      emoji: "😮‍💨", phrase: "عندي صعوبة في التنفس" },
      { id: "oxygen",      label: "عايز أكسجين",    emoji: "💨",   phrase: "مش قادر أتنفس كويس محتاج أكسجين" },
      { id: "cant_swallow_h",label: "مش قادر أبلع", emoji: "🚫",   phrase: "أنا مش قادر أبلع" },
      { id: "low_sugar",   label: "هبوط سكر",       emoji: "🍬",   phrase: "حاسس بهبوط عايز حاجة مسكرة" },
      { id: "fever_h",     label: "حرارة",           emoji: "🌡️",  phrase: "عندي حرارة" },
      { id: "wound_h",     label: "جرح",             emoji: "🩹",   phrase: "عندي جرح" },
      { id: "painkiller",  label: "مسكن",            emoji: "💊",   phrase: "محتاج مسكن" },
      { id: "med_time",    label: "معاد الدوا",      emoji: "⏰",   phrase: "معاد الدوا جه؟" },
      { id: "pressure_h",  label: "قياس الضغط",     emoji: "🩺",   phrase: "عايز أقيس الضغط" },
      { id: "doctor_h",    label: "الدكتور",         emoji: "👨‍⚕️", phrase: "عايز أشوف الدكتور" },
      { id: "cant_move_h", label: "مش قادر أتحرك",  emoji: "🦽",   phrase: "مش قادر أتحرك" },
      { id: "injection",     label: "حقنة",            emoji: "💉",   phrase: "محتاج حقنة" },
      { id: "itchy_h",       label: "حكة",             emoji: "😖",   phrase: "أنا حاسس بحكة شديدة" },
      { id: "numb_h",        label: "تنميل",            emoji: "🥴",   phrase: "إيدي/رجلي بتتنمل" },
      { id: "cramp_h",       label: "تشنج",             emoji: "⚡",   phrase: "عندي تشنج" },
      { id: "catheter_h",    label: "القسطرة",          emoji: "🩺",   phrase: "القسطرة بتوجعني" },
      {
        id: "pain_where",    label: "وجعني فين؟",      emoji: "📍",   phrase: "وجعني",
        children: [
          { id: "pain_neck",     label: "الرقبة",   emoji: "🧣",   phrase: "رقبتي بتوجعني" },
          { id: "pain_shoulder", label: "الكتف",    emoji: "🦴",   phrase: "كتفي بيوجعني" },
          { id: "pain_elbow",    label: "الكوع",    emoji: "💪",   phrase: "كوعي بيوجعني" },
          { id: "pain_wrist",    label: "الرسغ",    emoji: "✋",   phrase: "رسغي بيوجعني" },
          { id: "pain_palm",     label: "الكف",     emoji: "🤚",   phrase: "كفي بتوجعني" },
          { id: "pain_fingers",  label: "الأصابع",  emoji: "🖐️",  phrase: "أصابعي بتوجعني" },
          { id: "pain_knee",     label: "الركبة",   emoji: "🦵",   phrase: "ركبتي بتوجعني" },
          { id: "pain_thigh",    label: "الفخذ",    emoji: "🦵",   phrase: "فخذي بيوجعني" },
          { id: "pain_leg",      label: "الساق",    emoji: "🦵",   phrase: "ساقي بتوجعني" },
          { id: "pain_ankle",    label: "الكاحل",   emoji: "🦶",   phrase: "كاحلي بيوجعني" },
          { id: "pain_foot",     label: "القدم",    emoji: "🦶",   phrase: "قدمي بتوجعني" },
        ],
      },
    ],
  },

  // ─── 6. مشاعر وتواصل ──────────────────────────────────────────────────────
  {
    id: "feelings",
    label: "مشاعر",
    emoji: "😊",
    words: [
      { id: "happy_f",      label: "مبسوط",        emoji: "😄",   phrase: "أنا مبسوط" },
      { id: "sad_f",        label: "زعلان",         emoji: "😢",   phrase: "أنا زعلان" },
      { id: "scared_f",     label: "خايف",          emoji: "😨",   phrase: "أنا خايف" },
      { id: "worried_f",    label: "قلقان",         emoji: "😰",   phrase: "أنا قلقان" },
      { id: "angry_f",      label: "زعلان قوي",    emoji: "😠",   phrase: "أنا زعلان جداً" },
      { id: "calm_f",       label: "مرتاح",         emoji: "😌",   phrase: "أنا مرتاح" },
      { id: "bored_f",      label: "زهقت",          emoji: "😩",   phrase: "أنا زهقت" },
      { id: "cant_f",       label: "مش قادر",       emoji: "😞",   phrase: "أنا مش قادر" },
      { id: "hope_f",       label: "عندي أمل",      emoji: "🌟",   phrase: "عندي أمل وهكمل" },
      { id: "hug_f",        label: "عايز حضن",      emoji: "🤗",   phrase: "عايز حضن" },
      { id: "love_f",       label: "بحبك",          emoji: "❤️",   phrase: "أنا بحبك" },
      { id: "thanks_f",     label: "شكراً",         emoji: "🙏",   phrase: "شكراً جزيلاً جزاك الله خير" },
      { id: "sorry_f",      label: "معلش",          emoji: "🙇",   phrase: "معلش آسف لو بتعبك معايا" },
      { id: "who_knock",    label: "مين بيخبط",     emoji: "🚪",   phrase: "مين بيخبط؟ مين جه؟" },
      { id: "what_time",    label: "الساعة كام",    emoji: "🕐",   phrase: "الساعة كام دلوقتي؟" },
      { id: "good_night",   label: "تصبح على خير",  emoji: "🌙",   phrase: "تصبح على خير" },
      { id: "good_morning", label: "صباح الخير",    emoji: "☀️",   phrase: "صباح الخير" },
      { id: "stay_with",    label: "اقعد معايا",    emoji: "🤝",   phrase: "محتاج حد يقعد معايا متسيبنيش لوحدي" },
      { id: "no_visit",     label: "مش عايز حد",    emoji: "🔕",   phrase: "مش عايز حد يزورني دلوقتي" },
      { id: "cant_talk",    label: "مش قادر أتكلم", emoji: "🤫",   phrase: "تعبان ومش قادر أتكلم دلوقتي" },
      { id: "lonely_f",     label: "وحيد",          emoji: "🥺",   phrase: "أنا حاسس إني وحيد" },
      {
        id: "call_someone", label: "عايز أكلم",     emoji: "📞",   phrase: "عايز أكلم حد",
        children: [
          { id: "call_mama_f",   label: "ماما",      emoji: "👩",   phrase: "عايز أكلم ماما" },
          { id: "call_baba_f",   label: "بابا",      emoji: "👨",   phrase: "عايز أكلم بابا" },
          { id: "call_son_f",    label: "ابني",      emoji: "👦",   phrase: "عايز أكلم ابني" },
          { id: "call_doctor_f", label: "الدكتور",   emoji: "👨‍⚕️", phrase: "عايز أكلم الدكتور" },
        ],
      },
    ],
  },

  // ─── 7. ردود ───────────────────────────────────────────────────────────────
  {
    id: "responses",
    label: "ردود",
    emoji: "👍",
    words: [
      { id: "yes_resp",        label: "ايوه",        emoji: "✅",  phrase: "ايوه" },
      { id: "no_resp",         label: "لأ",           emoji: "❌",  phrase: "لأ" },
      { id: "maybe",           label: "ممكن",         emoji: "🤔",  phrase: "ممكن" },
      { id: "wait",            label: "استنى",        emoji: "✋",  phrase: "استنى شوية" },
      { id: "repeat",          label: "تاني",         emoji: "🔁",  phrase: "قول تاني" },
      { id: "slow",            label: "ببطء",         emoji: "🐢",  phrase: "ببطء من فضلك" },
      { id: "understand",      label: "فاهم",         emoji: "👌",  phrase: "أيوه فاهم" },
      { id: "not_understand",  label: "مش فاهم",     emoji: "❓",  phrase: "مش فاهم" },
      { id: "correct",         label: "صح",           emoji: "✔️",  phrase: "ده صح" },
      { id: "wrong",           label: "غلط",          emoji: "✖️",  phrase: "ده غلط" },
      { id: "more",            label: "أكتر",         emoji: "➕",  phrase: "عايز أكتر" },
      { id: "enough",          label: "كفاية",        emoji: "🛑",  phrase: "كفاية" },
      { id: "good_resp",       label: "تمام",         emoji: "👍",  phrase: "تمام" },
      { id: "not_sure",        label: "مش عارف",      emoji: "🤷",  phrase: "مش عارف" },
    ],
  },

  // ─── 8. العيلة ─────────────────────────────────────────────────────────────
  {
    id: "family",
    label: "العيلة",
    emoji: "👨‍👩‍👧",
    words: [
      { id: "call_mama",     label: "ماما",      emoji: "👩",     phrase: "نادوا على ماما" },
      { id: "call_baba",     label: "بابا",      emoji: "👨",     phrase: "نادوا على بابا" },
      { id: "call_son",      label: "ابني",      emoji: "👦",     phrase: "نادوا على ابني" },
      { id: "call_daughter", label: "بنتي",      emoji: "👧",     phrase: "نادوا على بنتي" },
      { id: "call_wife",     label: "مراتي",     emoji: "👩‍❤️‍👨", phrase: "نادوا على مراتي" },
      { id: "call_husband",  label: "جوزي",      emoji: "💑",     phrase: "نادوا على جوزي" },
      { id: "call_bro",      label: "أخويا",     emoji: "🧑",     phrase: "نادوا على أخويا" },
      { id: "call_sis",      label: "أختي",      emoji: "👩‍👧",   phrase: "نادوا على أختي" },
      { id: "call_grandpa",  label: "جدي",       emoji: "👴",     phrase: "نادوا على جدي" },
      { id: "call_grandma",  label: "جدتي",      emoji: "👵",     phrase: "نادوا على جدتي" },
      { id: "call_nurse",    label: "الممرض",    emoji: "👩‍⚕️",   phrase: "نادوا على الممرض" },
      { id: "call_doctor2",  label: "الدكتور",   emoji: "🩺",     phrase: "عايز أشوف الدكتور" },
      { id: "alone",         label: "وحيد",      emoji: "🥺",     phrase: "أنا وحيد عايز حد جنبي" },
    ],
  },

  // ─── 9. دعاء وذكر ─────────────────────────────────────────────────────────
  {
    id: "religion",
    label: "دعاء وذكر",
    emoji: "🤲",
    words: [
      { id: "want_pray",      label: "عايز أصلي",     emoji: "🕌",   phrase: "عايز أصلي" },
      { id: "need_wudu",      label: "محتاج وضوء",    emoji: "💧",   phrase: "محتاج أتوضأ" },
      { id: "allah_heal",     label: "اللهم اشفيني",  emoji: "🤲",   phrase: "اللهم اشفيني" },
      { id: "bismillah",      label: "بسم الله",       emoji: "✨",   phrase: "بسم الله" },
      { id: "alhamdulillah",  label: "الحمد لله",      emoji: "🙏",   phrase: "الحمد لله" },
      { id: "subhanallah",    label: "سبحان الله",     emoji: "⭐",   phrase: "سبحان الله" },
      { id: "allah_sabr",     label: "اللهم صبرني",   emoji: "💙",   phrase: "اللهم اجعلني من الصابرين" },
      { id: "aoudhu",         label: "أعوذ بالله",     emoji: "🛡️",  phrase: "أعوذ بالله من الشيطان الرجيم" },
    ],
  },
];
