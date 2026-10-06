import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PText, PriceSlider, useCheckBurst } from "@/components/provider/PUI";
import { Toggle } from "@/components/account/AccountUI";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { useProvider } from "@/contexts/ProviderContext";
import { DbSubService } from "@/lib/supabase";

type RowState = { on: boolean; price: number };

function rangeFor(sub: DbSubService, grade: string | null) {
  const consultant = grade === "استشاري";
  const min = (consultant ? sub.price_min_consultant : sub.price_min_specialist) ?? sub.price_min ?? 0;
  const max = (consultant ? sub.price_max_consultant : sub.price_max_specialist) ?? sub.price_max ?? 0;
  return { min, max: Math.max(max, min) };
}

export default function ProviderServicesScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const burst = useCheckBurst();
  const { provider, subServices, myServices, loadingBookings, refreshAll, saveMyServices } = useProvider();
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);

  const svcType = provider?.service_type || "كشف منزلي";
  const subs = subServices.filter((s) => s.service_name === svcType && s.group_name !== "grade");

  useEffect(() => {
    const next: Record<string, RowState> = {};
    for (const sub of subs) {
      const { min, max } = rangeFor(sub, provider?.grade ?? null);
      const existing = myServices.find((m) => m.sub_service_id === sub.id);
      const p = existing?.custom_price ?? min;
      next[sub.id] = { on: !!existing, price: Math.min(max, Math.max(min, p)) };
    }
    setRows(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myServices, subServices, provider?.service_type, provider?.grade]);

  const handleSave = async () => {
    const toSave = subs
      .filter((s) => rows[s.id]?.on)
      .map((s) => ({ sub_service_id: s.id, custom_price: rows[s.id].price }));
    setSaving(true);
    try {
      await saveMyServices(toSave);
      burst.show("تم حفظ خدماتك وأسعارك");
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="chevron-right" size={24} color={t.gold} />
        </Pressable>
        <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 21 }}>خدماتي وأسعاري</PText>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={loadingBookings} onRefresh={refreshAll} tintColor={t.gold} />}
      >
        <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "right", marginHorizontal: 4, marginBottom: 14, lineHeight: 21 }}>
          فعّل الخدمات وحدد سعرك ضمن نطاق الأدمن
        </PText>
        <View style={{ gap: 10 }}>
          {subs.map((sub) => {
            const row = rows[sub.id];
            if (!row) return null;
            const { min, max } = rangeFor(sub, provider?.grade ?? null);
            return (
              <View key={sub.id} style={{ backgroundColor: t.card, borderWidth: 1, borderColor: row.on ? t.goldRing : t.border, borderRadius: 22, padding: 16, opacity: row.on ? 1 : 0.6 }}>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 16, textAlign: "right" }}>{sub.name}</PText>
                    {sub.duration ? <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, marginTop: 2, textAlign: "right" }}>{sub.duration}</PText> : null}
                  </View>
                  <Toggle on={row.on} onChange={(v) => setRows((p) => ({ ...p, [sub.id]: { ...row, on: v } }))} />
                </View>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                  <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5 }}>سعرك</PText>
                  <PText style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 24 }}>
                    {row.price} <PText style={{ color: t.muted, fontFamily: TJ.bold, fontSize: 14 }}>ج.م</PText>
                  </PText>
                </View>
                <PriceSlider value={row.price} min={min} max={max} disabled={!row.on || max === min}
                  onChange={(v) => setRows((p) => ({ ...p, [sub.id]: { ...row, price: v } }))} />
                <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 2 }}>
                  <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5 }}>{min}</PText>
                  <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5 }}>نطاق الأدمن</PText>
                  <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5 }}>{max}</PText>
                </View>
              </View>
            );
          })}
          {subs.length === 0 ? (
            <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "center", paddingVertical: 50, lineHeight: 22 }}>
              لم تُضف خدمات لـ "{svcType}" بعد — تضيفها الإدارة
            </PText>
          ) : null}
        </View>
      </ScrollView>

      <View style={{ backgroundColor: t.nav, borderTopWidth: 1, borderTopColor: t.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) }}>
        <Pressable onPress={handleSave} disabled={saving || subs.length === 0}
          style={({ pressed }) => ({ borderRadius: 18, paddingVertical: 15, alignItems: "center", backgroundColor: t.gold, opacity: saving ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <PText style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 15.5 }}>{saving ? "جاري الحفظ..." : "حفظ خدماتي وأسعاري"}</PText>
        </Pressable>
      </View>
      {burst.node}
    </View>
  );
}
