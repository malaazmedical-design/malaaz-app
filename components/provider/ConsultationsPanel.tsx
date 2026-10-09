import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { SkeletonCards } from "@/components/Skeleton";
import { PText } from "@/components/provider/PUI";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { useProvider } from "@/contexts/ProviderContext";
import { CHANNEL_LABEL, dateTimeLabel, dayLabel, PERIOD_LABEL, STAGE_META, Stage, stageOf } from "@/lib/consult";
import { shortName } from "@/lib/providerFmt";
import { supabase, DbConsultation } from "@/lib/supabase";

type Filter = "upcoming" | "live" | "ended" | "cancelled";
const FILTER_OF: Record<Stage, Filter> = {
  pay_pending: "upcoming", need_time: "upcoming", time_pending: "upcoming", time_rejected: "upcoming", scheduled: "upcoming", doctor_late: "upcoming",
  live: "live", need_summary: "ended", done: "ended", no_show: "ended", cancelled: "cancelled",
};
// مراحل محتاجة إجراء من الطبيب
const ACTION: Stage[] = ["need_time", "scheduled", "doctor_late", "live", "need_summary"];

export function useProviderConsultations() {
  const { provider } = useProvider();
  const [rows, setRows] = useState<DbConsultation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!provider?.id) { setLoading(false); return; }
    const { data } = await supabase.from("consultations").select("*").eq("provider_id", provider.id).order("created_at", { ascending: false });
    setRows((data as DbConsultation[]) ?? []);
    setLoading(false);
  }, [provider?.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!provider?.id) return;
    const ch = supabase.channel(`prov_consults_${provider.id}_${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "consultations", filter: `provider_id=eq.${provider.id}` }, () => { load(); })
      .subscribe();
    const iv = setInterval(load, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [provider?.id, load]);

  const actionCount = rows.filter((r) => ACTION.includes(stageOf(r))).length;
  return { rows, loading, reload: load, actionCount };
}

export function ConsultationsPanel({ state }: { state: ReturnType<typeof useProviderConsultations> }) {
  const t = useMalaz();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [openEnded, setOpenEnded] = useState<Record<string, boolean>>({});
  const { rows, loading } = state;

  const staged = useMemo(() => rows.map((r) => ({ r, s: stageOf(r) })), [rows]);
  const counts = useMemo(() => {
    const m: Record<Filter, number> = { upcoming: 0, live: 0, ended: 0, cancelled: 0 };
    staged.forEach(({ s }) => { m[FILTER_OF[s]]++; });
    return m;
  }, [staged]);
  const shown = useMemo(() => {
    const list = staged.filter(({ s }) => FILTER_OF[s] === filter);
    // اللي محتاج إجراء الأول
    return list.sort((a, b) => Number(ACTION.includes(b.s)) - Number(ACTION.includes(a.s)));
  }, [staged, filter]);

  if (loading) return <SkeletonCards count={3} padded={false} />;

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 4, gap: 10 }}>
      <View style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" }}>
        {([["upcoming", "قادمة"], ["live", "جارية"], ["ended", "منتهية"], ["cancelled", "ملغية"]] as const).map(([k, name]) => {
          const on = filter === k;
          return (
            <Pressable key={k} onPress={() => setFilter(k)}
              style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: on ? t.goldTint : t.card, borderWidth: 1.5, borderColor: on ? t.gold : t.border }}>
              <PText style={{ color: on ? t.goldText : t.text2, fontFamily: TJ.heavy, fontSize: 14 }}>{name}</PText>
              <PText style={{ color: on ? t.goldText : t.muted, fontFamily: TJ.heavy, fontSize: 13 }}>{counts[k]}</PText>
            </Pressable>
          );
        })}
      </View>

      {shown.map(({ r, s }) => {
        const m = STAGE_META[s];
        const folded = (s === "done" || s === "no_show" || s === "cancelled") && !openEnded[r.id];
        return (
          <Pressable key={r.id}
            onPress={() => (folded ? setOpenEnded((o) => ({ ...o, [r.id]: true })) : router.push(`/provider-portal/consult/${r.id}`))}
            style={({ pressed }) => ({ backgroundColor: t.card, borderRadius: 22, padding: folded ? 12 : 14, borderWidth: 1, borderColor: ACTION.includes(s) ? t.goldRing : t.border, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
            <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <PText numberOfLines={1} style={{ flex: 1, color: t.text, fontFamily: TJ.heavy, fontSize: 15.5, textAlign: "right" }}>{shortName(r.client_name ?? "")}</PText>
              <View style={{ backgroundColor: m.color + "26", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                <PText style={{ color: m.color, fontFamily: TJ.bold, fontSize: 12.5 }}>{m.doctor}</PText>
              </View>
            </View>
            {!folded ? (
              <>
                <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "right", marginTop: 6 }}>
                  استشارة أونلاين · {CHANNEL_LABEL[r.channel]} · {r.duration_min + r.extra_min} د · {r.price} ج.م
                </PText>
                <PText style={{ color: t.text2, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "right", marginTop: 3 }}>
                  {r.appt_at ? dateTimeLabel(r.appt_at) : r.period === "asap" ? PERIOD_LABEL.asap : `${dayLabel(r.period_date)} · ${PERIOD_LABEL[r.period]}`}
                </PText>
                {s === "done" && r.rating ? <PText style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 13.5, textAlign: "right", marginTop: 3 }}>{r.rating_ok ? "★".repeat(r.rating) : "تقييم المريض قيد مراجعة الإدارة"}</PText> : null}
              </>
            ) : null}
          </Pressable>
        );
      })}

      {shown.length === 0 ? (
        <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "center", paddingVertical: 50, lineHeight: 24 }}>
          {filter === "upcoming" ? "لا توجد استشارات قادمة.\nفعّل الاستشارة الأونلاين من تعديل الحساب ليحجزها المرضى." : "لا توجد استشارات في هذه الحالة"}
        </PText>
      ) : null}
    </View>
  );
}
