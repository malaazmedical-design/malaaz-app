import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { useApp } from "@/contexts/AppContext";
import { stageOf } from "@/lib/consult";
import { useOnReconnect } from "@/lib/reconnect";
import { supabase, DbConsultation } from "@/lib/supabase";

// Consultations of the signed-in client that are still open (not finished, cancelled or no-show) — shown on the "الاستشارات" tab.
export function useClientConsultCount(): number {
  const { client } = useApp();
  const [n, setN] = useState(0);

  const load = useCallback(async () => {
    if (!client?.id) { setN(0); return; }
    const { data } = await supabase.from("consultations").select("*").eq("client_id", client.id);
    const rows = (data as DbConsultation[]) ?? [];
    setN(rows.filter((r) => !["done", "cancelled", "no_show", "need_summary"].includes(stageOf(r))).length);
  }, [client?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useOnReconnect(load);
  useEffect(() => {
    if (!client?.id) return;
    const ch = supabase.channel(`cl_consult_count_${client.id}_${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "consultations", filter: `client_id=eq.${client.id}` }, () => { load(); })
      .subscribe();
    const iv = setInterval(load, 60000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [client?.id, load]);

  return n;
}
