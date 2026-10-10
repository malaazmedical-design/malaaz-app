import { EN, EN_PATTERNS } from "./en";

const AR = /[\u0600-\u06FF]/;
const norm = (s: string) =>
  s.replace(/[\u064B-\u0652\u0640]/g, "").replace(/[\u0623\u0625\u0622]/g, "\u0627").replace(/\u0649/g, "\u064A").replace(/\u0629/g, "\u0647").replace(/\s+/g, " ");
// the dictionary is looked up ignoring diacritics / tatweel / repeated spaces and the hamza / alef-maqsura / ta-marbuta spelling variants
const INDEX: Record<string, string> = {};
for (const k of Object.keys(EN)) INDEX[norm(k).trim()] = EN[k];

// 1:1 normalisation (same length) used for patterns, so captured parts can be taken from the original text untouched
const norm1 = (s: string) => s.replace(/[\u0623\u0625\u0622]/g, "\u0627").replace(/\u0649/g, "\u064A").replace(/\u0629/g, "\u0647");

// pattern sources are normalised the same way, so they can be written with any spelling
const PATTERNS = EN_PATTERNS.map(([re, fn]) => [new RegExp(norm1(re.source), re.flags), fn] as const);

// Pure translation (no React): exact dictionary hit, then patterns. Leading / trailing spaces are kept; unknown texts are returned unchanged.
export function translate(s: string, again: (s: string) => string = (x) => translate(x)): string {
  if (!s || !AR.test(s)) return s;
  const lead = s.match(/^\s*/)![0];
  const trail = s.match(/\s*$/)![0];
  const hit = INDEX[norm(s).trim()];
  if (hit !== undefined) return lead + hit + trail;
  const orig = s.trim();
  const flat = norm1(orig);
  for (const [re, fn] of PATTERNS) {
    const m = flat.match(re);
    if (m) {
      // groups come from the original text (names keep their spelling)
      const out = [...m] as unknown as RegExpMatchArray;
      let from = 0;
      for (let i = 1; i < m.length; i++) {
        if (m[i] == null) continue;
        const at = flat.indexOf(m[i], Math.max(from, m.index ?? 0));
        if (at >= 0) { out[i] = orig.slice(at, at + m[i].length); from = at + m[i].length; }
      }
      return lead + fn(out, again) + trail;
    }
  }
  return s;
}
