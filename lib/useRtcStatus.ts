import { useCallback, useEffect, useState } from "react";

import { useOnReconnect } from "@/lib/reconnect";
import { supabase } from "@/lib/supabase";

// enabled: voice/video are shipped · available: the monthly free credit is not nearly used up.
// When enabled && !available the apps hide voice/video and offer chat only (the server enforces it too).
export function useRtcStatus() {
  const [s, setS] = useState({ enabled: false, available: false });
  const load = useCallback(() => {
    supabase.rpc("rtc_status").then(({ data }) => {
      const r = Array.isArray(data) ? data[0] : data;
      if (r) setS({ enabled: !!r.enabled, available: !!r.available });
    });
  }, []);
  useEffect(load, [load]);
  useOnReconnect(load);
  return s;
}
