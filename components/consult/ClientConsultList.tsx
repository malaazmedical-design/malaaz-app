import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SkeletonCards } from "@/components/Skeleton";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { useApp } from "@/contexts/AppContext";
import { CHANNEL_LABEL, dateTimeLabel, dayLabel, PERIOD_LABEL, STAGE_META, stageOf } from "@/lib/consult";
import { supabase, DbConsultation } from "@/lib/supabase";

// قائمة استشارات العميل (جوه "حجوزاتي")
export function ClientConsultList() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { client } = useApp();
  const [rows, setRows] = useState<DbConsultation[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!client?.id) { setLoading(false); return; }
    const { data } = await supabase.from("consultations").select("*").eq("client_id", client.id).order("created_at", { ascending: false });
    const list = (data as DbConsultation[]) ?? [];
    setRows(list);
    const ids = [...new Set(list.map((r) => r.provider_id))];
    if (ids.length) {
      const { data: ps } = await supabase.from("providers").select("id,name").in("id", ids);
      setNames(Object.fromEntries((ps ?? []).map((p: any) => [p.id, p.name])));
    }
    setLoading(false);
    setRefreshing(false);
  }, [client?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    if (!client?.id) return;
    const ch = supabase.channel(`cl_consults_${client.id}_${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "consultations", filter: `client_id=eq.${client.id}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [client?.id, load]);

  if (loading) return <SkeletonCards count={4} />;

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={t.gold} />}
    >
      {rows.length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: 50 }}>
          <MaterialCommunityIcons name="chat-processing-outline" size={48} color={t.muted} />
          <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 17, marginTop: 12 }}>{client ? "لا توجد استشارات بعد" : "سجّل دخولك لمتابعة استشاراتك"}</Text>
          <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, marginTop: 6, textAlign: "center" }}>احجز استشارة أونلاين من صفحة أي طبيب</Text>
        </View>
      ) : null}
      {rows.map((c) => {
        const s = stageOf(c);
        const m = STAGE_META[s];
        const n = names[c.provider_id] ?? "الطبيب";
        const action = s === "time_pending" || s === "live";
        return (
          <Pressable key={c.id} onPress={() => router.push(`/consult/${c.id}`)}
            style={({ pressed }) => ({ backgroundColor: t.card, borderRadius: 20, padding: 14, borderWidth: action ? 1.5 : 1, borderColor: action ? t.gold : t.border, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
            <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <Text numberOfLines={1} style={{ flex: 1, color: t.text, fontFamily: TJ.heavy, fontSize: 15.5, textAlign: "right" }}>{n.startsWith("د") ? n : `د. ${n}`}</Text>
              <View style={{ backgroundColor: m.color + "26", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: m.color, fontFamily: TJ.bold, fontSize: 12.5 }}>{m.client}</Text>
              </View>
            </View>
            <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "right", marginTop: 6 }}>استشارة أونلاين · {CHANNEL_LABEL[c.channel]} · {c.price} ج.م</Text>
            <Text style={{ color: t.text2, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "right", marginTop: 2 }}>
              {c.appt_at ? dateTimeLabel(c.appt_at) : c.period === "asap" ? PERIOD_LABEL.asap : `${dayLabel(c.period_date)} · ${PERIOD_LABEL[c.period]}`}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
