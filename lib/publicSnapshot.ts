// Public lists (providers, reviews, sub-services, areas, pins) as one JSON file served by the Supabase Storage CDN.
// The file is rebuilt every 2 minutes on the server (supabase/original-merge/10_public_snapshot.sql + the public-snapshot
// Edge Function). Returns null when it is missing, too old or broken: the caller then reads the database directly.
const SNAPSHOT_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-snapshots/providers.json`;
const MAX_AGE_MS = 60 * 60 * 1000; // older than an hour = the refresh job is not running: do not trust it
const TIMEOUT_MS = 6000;

export type PublicSnapshot = {
  providers: any[];
  reviews: any[];
  subs: any[];
  areas: any[];
  providerServices: any[];
  pins: any[];
};

export async function fetchPublicSnapshot(): Promise<PublicSnapshot | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(SNAPSHOT_URL, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const d = await res.json();
    const age = Date.now() - new Date(d?.generated_at).getTime();
    if (!Number.isFinite(age) || age > MAX_AGE_MS) return null;
    if (!Array.isArray(d.providers) || !d.providers.length) return null;
    return {
      providers: d.providers,
      reviews: Array.isArray(d.reviews) ? d.reviews : [],
      subs: Array.isArray(d.subs) ? d.subs : [],
      areas: Array.isArray(d.areas) ? d.areas : [],
      providerServices: Array.isArray(d.providerServices) ? d.providerServices : [],
      pins: Array.isArray(d.pins) ? d.pins : [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
