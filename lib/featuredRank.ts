import { normalizeArabic, Provider } from "@/constants/data";

export type FeaturedPin = { area: string; provider_id: string; position: number };

export const TOP_SLOTS = 10;
// how the free slots are shared between provider types when enough of each exist (doctors / nursing / x-ray)
const TYPE_SHARE: Record<string, number> = { doctor: 0.6, nurse: 0.2, xray: 0.2 };

const norm = (s: string) => normalizeArabic(s || "");

/** providers that list the given coverage area (spelling-insensitive) */
export function coversArea(p: Provider, area: string): boolean {
  const a = norm(area);
  if (!a) return false;
  return p.areas.some((x) => norm(x) === a);
}

// stable "random" per provider per day, so the front page rotates daily instead of always favouring the newest sign-ups
function dailyKey(id: string, day: string): number {
  let h = 2166136261;
  const s = day + "|" + id;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function completeness(p: Provider): number {
  const hasPhoto = typeof p.avatar === "object" && p.avatar !== null && "uri" in p.avatar && !!(p.avatar as { uri?: string }).uri;
  return (hasPhoto ? 1 : 0) + (p.areas.length > 0 ? 1 : 0) + (p.services.length > 0 ? 1 : 0) + (p.title && !/^(طبيب منزلي|ممرض|أخصائي أشعة|مقدم خدمة)/.test(p.title) ? 1 : 0);
}

/**
 * The home screen's top list.
 *  (used only on the plain home screen: no search, no type / grade / specialty filter, "highest rated" sort)
 *  1) providers pinned by the admin for the client's area (then for all areas), in the admin's order
 *  2) the rest, limited to providers who cover the client's area when the area is known (falls back to the given list when nobody does)
 *     ranked: available now → real reviews (higher, then more) → complete profile → daily rotation
 *     and shared between doctors / nursing / x-ray so one type does not take every slot
 */
export function pickTopProviders(opts: {
  list: Provider[];            // already filtered (city, type, ...) in display order
  everyone: Provider[];        // all active providers (pins may sit outside the filtered list)
  pins: FeaturedPin[];
  area: string | null;
  day: string;                 // e.g. "2026-10-15"
  limit?: number;
}): Provider[] {
  const limit = opts.limit ?? TOP_SLOTS;
  const byId = new Map(opts.everyone.map((p) => [p.id, p]));

  // 1) pins: the client's own area first, then "all areas"
  const pinRows = opts.pins
    .filter((x) => x.area === "*" || (opts.area && norm(x.area) === norm(opts.area)))
    .sort((a, b) => (a.area === "*" ? 1 : 0) - (b.area === "*" ? 1 : 0) || a.position - b.position);
  const out: Provider[] = [];
  const used = new Set<string>();
  for (const pin of pinRows) {
    const p = byId.get(pin.provider_id);
    if (!p || used.has(p.id) || out.length >= limit) continue;
    out.push(p); used.add(p.id);
  }
  if (out.length >= limit) return out.slice(0, limit);

  // 2) automatic ranking for the free slots
  let pool = opts.list.filter((p) => !used.has(p.id));
  if (opts.area) {
    const here = pool.filter((p) => coversArea(p, opts.area!));
    if (here.length > 0) pool = here;
  }
  pool = [...pool].sort((a, b) => {
    const av = Number(b.available) - Number(a.available);
    if (av) return av;
    const ra = (b.reviewsCount ? b.rating : 0) - (a.reviewsCount ? a.rating : 0);
    if (ra) return ra;
    if (b.reviewsCount !== a.reviewsCount) return b.reviewsCount - a.reviewsCount;
    const c = completeness(b) - completeness(a);
    if (c) return c;
    return dailyKey(a.id, opts.day) - dailyKey(b.id, opts.day);
  });

  const free = limit - out.length;
  const types = Array.from(new Set(pool.map((p) => p.serviceType)));
  const taken: Provider[] = [];
  if (types.length > 1) {
    const shareSum = types.reduce((s, t) => s + (TYPE_SHARE[t] ?? 0.2), 0);
    for (const t of types) {
      const quota = Math.max(1, Math.round((free * (TYPE_SHARE[t] ?? 0.2)) / shareSum));
      taken.push(...pool.filter((p) => p.serviceType === t).slice(0, quota));
    }
  }
  const takenIds = new Set(taken.map((p) => p.id));
  const picked = [...taken, ...pool.filter((p) => !takenIds.has(p.id))].slice(0, free);
  // keep the final order meaningful: ranking order, not "type by type"
  const order = new Map(pool.map((p, i) => [p.id, i]));
  picked.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return [...out, ...picked];
}
