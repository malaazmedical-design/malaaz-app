import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { useRtcStatus } from "@/lib/useRtcStatus";

export type OnlineOffer = { chat?: number; voice?: number; video?: number };

// Online consultation per provider (chat price from provider_services, voice/video from provider_channels).
// Voice/video only count once the admin switched them on; one small request for the whole list.
let cache: Record<string, OnlineOffer> | null = null;

export function useOnlineOffers(): Record<string, OnlineOffer> {
  const rtc = useRtcStatus();
  const [raw, setRaw] = useState<Record<string, OnlineOffer>>(cache ?? {});

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<string, OnlineOffer> = {};
      const { data: subs } = await supabase.from("sub_services").select("id").eq("group_name", "online");
      const ids = (subs ?? []).map((s: any) => s.id);
      if (ids.length) {
        const { data } = await supabase.from("provider_services").select("provider_id,custom_price").in("sub_service_id", ids).eq("is_active", true);
        for (const r of (data ?? []) as any[]) if (r.custom_price) (out[r.provider_id] ??= {}).chat = Number(r.custom_price);
      }
      const { data: pcs } = await supabase.from("provider_channels").select("provider_id,channel,price").eq("is_active", true);
      for (const r of (pcs ?? []) as any[]) if (out[r.provider_id]) out[r.provider_id][r.channel as "voice" | "video"] = Number(r.price);
      cache = out;
      if (alive) setRaw(out);
    })();
    return () => { alive = false; };
  }, []);

  if (rtc.enabled) return raw;
  // voice/video not live yet: show chat only
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, { chat: v.chat }]));
}

export const lowestOnline = (o?: OnlineOffer): number | null => {
  const v = o ? [o.chat, o.voice, o.video].filter((x): x is number => typeof x === "number") : [];
  return v.length ? Math.min(...v) : null;
};
