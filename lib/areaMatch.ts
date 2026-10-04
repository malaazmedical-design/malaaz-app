import { normalizeArabic } from "@/constants/data";

// Common English/transliterated place names (what the device geocoder returns when the
// phone language is English) mapped to the Arabic wording used in coverage areas.
const ALIASES: [RegExp, string[]][] = [
  [/nasr\s*city|مدينة نصر/i, ["مدينه نصر", "نصر"]],
  [/maadi|المعادي/i, ["معادي"]],
  [/heliopolis|masr el.?gedida|مصر الجديدة/i, ["مصر الجديده", "هليوبوليس"]],
  [/new cairo|fifth settlement|tagamo|التجمع|القاهرة الجديدة/i, ["القاهره الجديده", "التجمع"]],
  [/dokki|الدقي/i, ["دقي"]],
  [/mohandessin|mohandiseen|المهندسين/i, ["مهندسين"]],
  [/zamalek|الزمالك/i, ["زمالك"]],
  [/6th of october|october|أكتوبر/i, ["اكتوبر"]],
  [/sheikh zayed|الشيخ زايد/i, ["شيخ زايد"]],
  [/shubra|شبرا/i, ["شبرا"]],
  [/haram|الهرم/i, ["هرم"]],
  [/faisal|فيصل/i, ["فيصل"]],
  [/agouza|العجوزة/i, ["عجوزه"]],
  [/imbaba|إمبابة/i, ["امبابه"]],
  [/mokattam|المقطم/i, ["مقطم"]],
  [/rehab|الرحاب/i, ["رحاب"]],
  [/madinaty|مدينتي/i, ["مدينتي"]],
  [/shorouk|الشروق/i, ["شروق"]],
  [/obour|العبور/i, ["عبور"]],
  [/ain shams|عين شمس/i, ["عين شمس"]],
  [/matareya|المطرية/i, ["مطريه"]],
  [/downtown|وسط البلد/i, ["وسط البلد"]],
  [/garden city|جاردن سيتي/i, ["جاردن سيتي"]],
  [/giza|الجيزة/i, ["جيزه"]],
  [/cairo|القاهرة/i, ["قاهره"]],
  [/alexandria|الإسكندرية/i, ["اسكندريه"]],
];

type Area = { id: string; name: string; city: string | null };

// Returns the best matching coverage area for a set of geocoder strings, or null.
export function matchCoverageArea(candidates: (string | null | undefined)[], areas: Area[]): Area | null {
  const texts = candidates.filter((c): c is string => !!c && c.trim().length > 0);
  if (!texts.length || !areas.length) return null;

  const normalized = areas.map((a) => ({ a, n: normalizeArabic(a.name) }));
  const wanted = new Set<string>();
  for (const t of texts) {
    const nt = normalizeArabic(t);
    if (nt) wanted.add(nt);
    for (const [re, targets] of ALIASES) {
      if (re.test(t)) targets.forEach((x) => wanted.add(normalizeArabic(x)));
    }
  }

  // most specific first: candidate order (district before city), longer area names first
  for (const w of wanted) {
    const hit = [...normalized]
      .sort((x, y) => y.n.length - x.n.length)
      .find(({ n }) => n && (n === w || n.includes(w) || w.includes(n)));
    if (hit) return hit.a;
  }
  return null;
}
