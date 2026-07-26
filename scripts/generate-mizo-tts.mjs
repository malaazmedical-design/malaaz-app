/**
 * One-time script: generate all standard Mizo phrases via ElevenLabs
 * and upload them to Supabase Storage (mizo-tts bucket).
 *
 * Usage:
 *   ELEVEN_API_KEY=sk-...  ELEVEN_VOICE_ID=...  node scripts/generate-mizo-tts.mjs
 *
 * Optional env:
 *   SUPABASE_URL   (defaults to the project URL)
 *   SUPABASE_KEY   (use the service_role key so uploads work)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://omsictbrqlsohrmxeuym.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
const ELEVEN_VOICE_ID = process.env.ELEVEN_VOICE_ID;

if (!SUPABASE_KEY || !ELEVEN_API_KEY || !ELEVEN_VOICE_ID) {
  console.error("Missing required env vars: SUPABASE_KEY, ELEVEN_API_KEY, ELEVEN_VOICE_ID");
  process.exit(1);
}

// ── All standard Mizo phrases ──────────────────────────────────────────────
const PHRASES = [
  // basic
  { id: "eat",              phrase: "أنا عايز آكل" },
  { id: "water",            phrase: "أنا عايز مية" },
  { id: "tea",              phrase: "أنا عايز شاي" },
  { id: "bathroom",         phrase: "محتاج الحمام" },
  { id: "sleep",            phrase: "أنا عايز أنام" },
  { id: "medicine",         phrase: "محتاج الدوا" },
  { id: "pain",             phrase: "أنا وجعني" },
  { id: "doctor",           phrase: "عايز أشوف الدكتور" },
  { id: "sit",              phrase: "عايز أقعد" },
  { id: "lie_down",         phrase: "عايز أتمدد" },
  { id: "cold_feel",        phrase: "أنا بردان" },
  { id: "hot_feel",         phrase: "أنا حران" },
  // food & drink
  { id: "water_det",        phrase: "أنا عايز مية" },
  { id: "water_cold",       phrase: "عايز مية ساقعة" },
  { id: "water_warm",       phrase: "عايز مية دافية" },
  { id: "water_straw",      phrase: "عايز أشرب بالقشة" },
  { id: "water_close",      phrase: "هات المية جنبي أنا مش قادر أوصالها" },
  { id: "hungry",           phrase: "أنا جعان عايز آكل" },
  { id: "food_light",       phrase: "عايز حاجة خفيفة" },
  { id: "food_soup",        phrase: "عايز شوربة" },
  { id: "food_yogurt",      phrase: "عايز زبادي" },
  { id: "food_fruit",       phrase: "عايز فاكهة" },
  { id: "full",             phrase: "شبعت مش قادر أكمل" },
  { id: "food_hot",         phrase: "الأكل سخن أوي خليه يبرد شوية" },
  { id: "food_cold",        phrase: "الأكل بارد" },
  { id: "cut_food",         phrase: "قطعلي الأكل وصغر اللقمة من فضلك" },
  { id: "cant_swallow",     phrase: "أنا مش قادر أبلع" },
  { id: "no_more_food",     phrase: "أنا مش عايز أكل دلوقتي" },
  { id: "tea_det",          phrase: "أنا عايز شاي" },
  { id: "coffee_det",       phrase: "أنا عايز قهوة" },
  { id: "anise",            phrase: "أنا عايز يانسون" },
  { id: "juice",            phrase: "أنا عايز عصير" },
  // comfort
  { id: "sit_up",           phrase: "عايز أقعد" },
  { id: "lie_d",            phrase: "عايز أتمدد" },
  { id: "pillow_up",        phrase: "ارفع المخدة من فضلك" },
  { id: "pillow_down",      phrase: "نزل المخدة من فضلك" },
  { id: "turn",             phrase: "عايز أتقلب" },
  { id: "turn_right",       phrase: "عايز أتقلب على يميني" },
  { id: "turn_left",        phrase: "عايز أتقلب على شمالي" },
  { id: "back_hurt",        phrase: "ظهري بيوجعني من القعدة" },
  { id: "help_stand",       phrase: "ساعدني أقف من فضلك" },
  { id: "fix_legs",         phrase: "عدلي رجلي من فضلك" },
  { id: "hot_env",          phrase: "أنا حران" },
  { id: "ac_on",            phrase: "شغل التكييف من فضلك" },
  { id: "fan_on",           phrase: "شغل المروحة من فضلك" },
  { id: "cold_env",         phrase: "أنا بردان غطيني" },
  { id: "cover_light",      phrase: "غطيني بغطا خفيف" },
  { id: "cover_heavy",      phrase: "عايز غطا تقيل" },
  { id: "light_off",        phrase: "اقفل النور من فضلك النور ضارب في عيني" },
  { id: "light_on",         phrase: "افتح النور من فضلك" },
  { id: "window_open",      phrase: "افتح الشباك من فضلك" },
  { id: "window_close",     phrase: "اقفل الشباك من فضلك" },
  { id: "tv_on",            phrase: "شغل التلفزيون من فضلك" },
  { id: "tv_up",            phrase: "علي صوت التلفزيون" },
  { id: "tv_down",          phrase: "هدي صوت التلفزيون" },
  { id: "tv_channel",       phrase: "غير القناة من فضلك" },
  { id: "quran",            phrase: "عايز أسمع قرآن" },
  { id: "radio",            phrase: "عايز أسمع راديو" },
  { id: "get_mobile",       phrase: "هات لي الموبايل من فضلك" },
  { id: "glasses",          phrase: "هات لي النظارة من فضلك" },
  // hygiene
  { id: "bathroom_hy",      phrase: "محتاج الحمام ضروري" },
  { id: "change",           phrase: "عايز أغير" },
  { id: "change_clothes",   phrase: "عايز أغير ملابسي" },
  { id: "change_diaper",    phrase: "محتاج أغير البامبرز" },
  { id: "wash_face",        phrase: "عايز أغسل وشي" },
  { id: "wash_teeth",       phrase: "عايز أغسل أسناني" },
  { id: "wash_hands",       phrase: "عايز أغسل إيدي" },
  { id: "shower",           phrase: "عايز أستحمى" },
  { id: "tissue",           phrase: "هات لي منديل من فضلك" },
  { id: "towel",            phrase: "هات لي فوطة من فضلك" },
  { id: "dry_mouth",        phrase: "ريقي ناشف عايز أبل شفايفي" },
  { id: "bed_clean",        phrase: "السرير محتاج ينضف" },
  // health
  { id: "pain_gen",         phrase: "أنا وجعني" },
  { id: "pain_str",         phrase: "الوجع شديد جداً" },
  { id: "head_pain",        phrase: "راسي بيوجعني" },
  { id: "belly_pain",       phrase: "بطني بتوجعني" },
  { id: "back_pain",        phrase: "ضهري بيوجعني" },
  { id: "chest_pain",       phrase: "صدري بيوجعني" },
  { id: "good_h",           phrase: "أنا كويس الحمد لله" },
  { id: "tired_h",          phrase: "أنا تعبان" },
  { id: "dizzy_h",          phrase: "أنا حاسس بدوخة" },
  { id: "nausea_h",         phrase: "أنا حاسس بغثيان" },
  { id: "vomit",            phrase: "أنا هرجع خدوا البانيه" },
  { id: "breathe_h",        phrase: "عندي صعوبة في التنفس" },
  { id: "oxygen",           phrase: "مش قادر أتنفس كويس محتاج أكسجين" },
  { id: "cant_swallow_h",   phrase: "أنا مش قادر أبلع" },
  { id: "low_sugar",        phrase: "حاسس بهبوط عايز حاجة مسكرة" },
  { id: "fever_h",          phrase: "عندي حرارة" },
  { id: "wound_h",          phrase: "عندي جرح" },
  { id: "painkiller",       phrase: "محتاج مسكن" },
  { id: "med_time",         phrase: "معاد الدوا جه؟" },
  { id: "pressure_h",       phrase: "عايز أقيس الضغط" },
  { id: "doctor_h",         phrase: "عايز أشوف الدكتور" },
  { id: "cant_move_h",      phrase: "مش قادر أتحرك" },
  { id: "injection",        phrase: "محتاج حقنة" },
  // feelings
  { id: "happy_f",          phrase: "أنا مبسوط" },
  { id: "sad_f",            phrase: "أنا زعلان" },
  { id: "scared_f",         phrase: "أنا خايف" },
  { id: "worried_f",        phrase: "أنا قلقان" },
  { id: "angry_f",          phrase: "أنا زعلان جداً" },
  { id: "calm_f",           phrase: "أنا مرتاح" },
  { id: "bored_f",          phrase: "أنا زهقت" },
  { id: "cant_f",           phrase: "أنا مش قادر" },
  { id: "hope_f",           phrase: "عندي أمل وهكمل" },
  { id: "hug_f",            phrase: "عايز حضن" },
  { id: "love_f",           phrase: "أنا بحبك" },
  { id: "thanks_f",         phrase: "شكراً جزيلاً جزاك الله خير" },
  { id: "sorry_f",          phrase: "معلش آسف لو بتعبك معايا" },
  { id: "who_knock",        phrase: "مين بيخبط؟ مين جه؟" },
  { id: "what_time",        phrase: "الساعة كام دلوقتي؟" },
  { id: "good_night",       phrase: "تصبح على خير" },
  { id: "good_morning",     phrase: "صباح الخير" },
  { id: "stay_with",        phrase: "محتاج حد يقعد معايا متسيبنيش لوحدي" },
  { id: "no_visit",         phrase: "مش عايز حد يزورني دلوقتي" },
  { id: "cant_talk",        phrase: "تعبان ومش قادر أتكلم دلوقتي" },
  { id: "lonely_f",         phrase: "أنا حاسس إني وحيد" },
  { id: "call_someone",     phrase: "عايز أكلم حد" },
  { id: "call_mama_f",      phrase: "عايز أكلم ماما" },
  { id: "call_baba_f",      phrase: "عايز أكلم بابا" },
  { id: "call_son_f",       phrase: "عايز أكلم ابني" },
  { id: "call_doctor_f",    phrase: "عايز أكلم الدكتور" },
  // responses
  { id: "yes_resp",         phrase: "ايوه" },
  { id: "no_resp",          phrase: "لأ" },
  { id: "maybe",            phrase: "ممكن" },
  { id: "wait",             phrase: "استنى شوية" },
  { id: "repeat",           phrase: "قول تاني" },
  { id: "slow",             phrase: "ببطء من فضلك" },
  { id: "understand",       phrase: "أيوه فاهم" },
  { id: "not_understand",   phrase: "مش فاهم" },
  { id: "correct",          phrase: "ده صح" },
  { id: "wrong",            phrase: "ده غلط" },
  { id: "more",             phrase: "عايز أكتر" },
  { id: "enough",           phrase: "كفاية" },
  { id: "good_resp",        phrase: "تمام" },
  { id: "not_sure",         phrase: "مش عارف" },
  // family
  { id: "call_mama",        phrase: "نادوا على ماما" },
  { id: "call_baba",        phrase: "نادوا على بابا" },
  { id: "call_son",         phrase: "نادوا على ابني" },
  { id: "call_daughter",    phrase: "نادوا على بنتي" },
  { id: "call_wife",        phrase: "نادوا على مراتي" },
  { id: "call_husband",     phrase: "نادوا على جوزي" },
  { id: "call_bro",         phrase: "نادوا على أخويا" },
  { id: "call_sis",         phrase: "نادوا على أختي" },
  { id: "call_grandpa",     phrase: "نادوا على جدي" },
  { id: "call_grandma",     phrase: "نادوا على جدتي" },
  { id: "call_nurse",       phrase: "نادوا على الممرض" },
  { id: "call_doctor2",     phrase: "عايز أشوف الدكتور" },
  { id: "alone",            phrase: "أنا وحيد عايز حد جنبي" },
  // quick responses
  { id: "yes_quick",        phrase: "ايوه" },
  { id: "no_quick",         phrase: "لأ" },
];

// ── ElevenLabs API ────────────────────────────────────────────────────────────

async function generateMp3(phrase) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: phrase,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── Main ──────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let done = 0, skipped = 0, failed = 0;

for (const { id, phrase } of PHRASES) {
  const path = `${id}.mp3`;

  // Skip if already exists
  const { data: existing } = await supabase.storage
    .from("mizo-tts")
    .list("", { search: id });
  if (existing?.some((f) => f.name === `${id}.mp3`)) {
    console.log(`  skip  ${id}`);
    skipped++;
    continue;
  }

  try {
    const mp3 = await generateMp3(phrase);
    const { error } = await supabase.storage
      .from("mizo-tts")
      .upload(path, mp3, { contentType: "audio/mpeg", upsert: true });
    if (error) throw error;
    console.log(`  ✓ ${id}  (${mp3.length} bytes)`);
    done++;
    // Respect ElevenLabs rate limit
    await new Promise((r) => setTimeout(r, 250));
  } catch (e) {
    console.error(`  ✗ ${id}:`, e.message);
    failed++;
  }
}

console.log(`\nDone: ${done} generated, ${skipped} skipped, ${failed} failed`);
