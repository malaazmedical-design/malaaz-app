import React, { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PText, SwipeButton, useCheckBurst } from "@/components/provider/PUI";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { ProviderOffer, useProvider } from "@/contexts/ProviderContext";
import { PERIOD_LABEL, dateLabelOf, periodOf } from "@/lib/providerFmt";

export default function ProviderOffersScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { offers, loadingOffers, refreshOffers, respondToOffer } = useProvider();
  const burst = useCheckBurst();
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (o: ProviderOffer, action: "accept" | "decline") => {
    if (busy) return;
    setBusy(o.id);
    try {
      const ok = await respondToOffer(o.id, action);
      if (action === "accept") {
        if (ok) burst.show("تم قبول الحجز");
        else Alert.alert("للأسف", "العرض ده بقى مش متاح — على الأرجح اتقبل من مقدم تاني.");
      }
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "تعذر تنفيذ الطلب");
    } finally {
      setBusy(null);
    }
  };

  const confirmDecline = (o: ProviderOffer) =>
    Alert.alert("رفض العرض", "متأكد إنك عايز ترفض العرض ده؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "رفض", style: "destructive", onPress: () => act(o, "decline") },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 18, paddingHorizontal: 16, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={loadingOffers} onRefresh={refreshOffers} tintColor={t.gold} />}
      >
        <View style={{ paddingHorizontal: 4, paddingBottom: 14 }}>
          <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 24, textAlign: "right" }}>عروض جديدة</PText>
          <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "right", marginTop: 2 }}>اقبل الحجز أو ارفضه</PText>
        </View>

        <View style={{ gap: 10 }}>
          {offers.map((o) => (
            <View key={o.id} style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.goldRing, borderRadius: 22, padding: 14 }}>
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <PText numberOfLines={2} style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15.5, textAlign: "right" }}>
                    {o.sub_option ?? o.service_type ?? "حجز جديد"}
                  </PText>
                  {o.sub_option && o.service_type ? (
                    <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, marginTop: 2, textAlign: "right" }}>{o.service_type}</PText>
                  ) : null}
                </View>
                {o.distance_km != null ? (
                  <PText style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 16 }}>{Number(o.distance_km).toFixed(1)} كم</PText>
                ) : null}
              </View>
              <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, marginTop: 8, textAlign: "right" }}>
                {dateLabelOf(o.appointment_time)} · {PERIOD_LABEL[periodOf(o.appointment_time)]} · {o.area ?? "—"}
              </PText>
              <PText style={{ color: t.text2, fontFamily: TJ.medium, fontSize: 12.5, marginTop: 4, textAlign: "right" }}>
                تظهر بيانات العميل الكاملة والموقع بعد القبول.
              </PText>
              <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 16, alignItems: "center" }}>
                <View style={{ flex: 1, opacity: busy === o.id ? 0.5 : 1 }} pointerEvents={busy === o.id ? "none" : "auto"}>
                  <SwipeButton label="اسحب للقبول" height={46} onConfirm={() => act(o, "accept")} />
                </View>
                <Pressable onPress={() => confirmDecline(o)} style={({ pressed }) => ({ width: 92, borderWidth: 1.5, borderColor: t.border, borderRadius: 14, paddingVertical: 11, alignItems: "center", transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                  <PText style={{ color: t.text2, fontFamily: TJ.bold, fontSize: 14 }}>رفض</PText>
                </Pressable>
              </View>
            </View>
          ))}
          {offers.length === 0 ? (
            <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "center", paddingVertical: 60 }}>لا توجد عروض جديدة الآن</PText>
          ) : null}
        </View>
      </ScrollView>
      {burst.node}
    </View>
  );
}
