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

// English names of admin-managed data (specialties, governorates, cities, services) loaded from the database.
const DYN: Record<string, string> = {};
export function setDynamicNames(map: Record<string, string>) {
  for (const k of Object.keys(DYN)) delete DYN[k];
  for (const [ar, en] of Object.entries(map)) if (ar && en) DYN[norm(ar).trim()] = en;
}
const lookup = (s: string): string | undefined => {
  const k = norm(s).trim();
  return INDEX[k] ?? DYN[k];
};

// "استشاري قلب" / "قلب · القاهرة": translate part by part (split on separators), then word by word with the longest known phrase first.
// A text made only of known words is translated; a text with an unknown word (e.g. a person's name) stays as it is.
function composite(orig: string): string | null {
  const parts = orig.split(/( · |، | - | — )/);
  if (parts.length > 1) {
    let changed = false;
    const out = parts.map((p, i) => {
      if (i % 2) return p;
      const t = lookup(p) ?? words(p);
      if (t != null) { changed = true; return t; }
      return p;
    });
    return changed ? out.join("") : null;
  }
  return words(orig);
}
function words(p: string): string | null {
  const w = p.trim().split(/\s+/);
  if (w.length < 2) return null;
  const out: string[] = [];
  for (let i = 0; i < w.length;) {
    let hit: string | undefined; let len = 0;
    for (let l = w.length - i; l >= 1; l--) { hit = lookup(w.slice(i, i + l).join(" ")); if (hit !== undefined) { len = l; break; } }
    if (hit === undefined) return null;
    out.push(hit); i += len;
  }
  return out.join(" ");
}

// Pure translation (no React): exact dictionary hit, then patterns. Leading / trailing spaces are kept; unknown texts are returned unchanged.
export function translate(s: string, again: (s: string) => string = (x) => translate(x)): string {
  if (!s || !AR.test(s)) return s;
  const lead = s.match(/^\s*/)![0];
  const trail = s.match(/\s*$/)![0];
  const hit = lookup(s);
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
  const comp = composite(orig);
  return comp != null ? lead + comp + trail : s;
}
