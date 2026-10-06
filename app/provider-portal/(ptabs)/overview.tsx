import { router } from "expo-router";
import { Image } from "expo-image";
import React, { useMemo } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PText } from "@/components/provider/PUI";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { useProvider } from "@/contexts/ProviderContext";
import {
  PERIOD_HOURS, PERIOD_LABEL, STATE_META, initialOf, isToday, periodOf, shortName, stateOf,
} from "@/lib/providerFmt";

const LOGO_LIGHT = require("../../../assets/images/malaz/logo-light.png");
const LOGO_DARK = require("../../../assets/images/malaz/logo-dark.png");

const SLOTS = ["morning", "noon", "evening"] as const;

export default function ProviderOverviewScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { provider, bookings, offers, loadingBookings, refreshAll, toggleAvailability } = useProvider();

  const states = useMemo(() => bookings.map((b) => ({ b, s: stateOf(b) })), [bookings]);
  const onway = states.find((x) => x.s === "onway");
  const confirmed = states.find((x) => x.s === "confirmed");
  const doneCount = states.filter((x) => x.s === "done").length;

  const timeline = useMemo(
    () =>
      SLOTS.map((slot) => ({
        slot,
        items: states.filter(({ b, s }) => {
          if (s === "cancelled" || s === "new" || !isToday(b.appointment_time)) return false;
          const p = periodOf(b.appointment_time);
          return p === slot || (p === "asap" && slot === "morning");
        }),
      })),
    [states],
  );

  if (!provider) return null;
  const available = provider.is_available ?? false;

  const goBookings = (focus?: string) =>
    router.navigate({ pathname: "/provider-portal/(ptabs)/bookings", params: focus ? { focus } : {} });
  const goOffers = () => router.navigate("/provider-portal/(ptabs)/offers");

  const flip = async (v: boolean) => {
    try { await toggleAvailability(v); } catch (e: any) { Alert.alert("خطأ", e.message ?? "تعذر التحديث"); }
  };

  // أولوية "الخطوة التالية": غير متاح ← في الطريق ← عروض جديدة ← زيارة قادمة ← لا شيء
  const smart = (() => {
    if (!available) return { t: "أنت غير متاح الآن", s: "العملاء لا يرونك في نتائج البحث", a: "تفعيل", go: () => flip(true) };
    if (onway) return { t: `أنت في الطريق إلى ${shortName(onway.b.patient_name)}`, s: onway.b.sub_option ?? onway.b.service_type, a: "عرض الحجز", go: () => goBookings(onway.b.id) };
    if (offers.length > 0)
      return { t: offers.length === 1 ? "عرض جديد ينتظر ردك" : `${offers.length} عروض جديدة تنتظر ردك`, s: "أول من يقبل يحجز", a: "عرض العروض", go: goOffers };
    if (confirmed)
      return { t: `الزيارة القادمة · ${PERIOD_LABEL[periodOf(confirmed.b.appointment_time)]}`, s: `${shortName(confirmed.b.patient_name)} · ${confirmed.b.area ?? ""}`, a: "عرض الحجز", go: () => goBookings(confirmed.b.id) };
    return { t: "لا توجد مهام الآن", s: "سنُعلمك عند وصول عرض جديد", a: null as string | null, go: () => {} };
  })();

  const stats = [
    { v: bookings.length, l: "إجمالي حجوزاتي", go: () => goBookings(), c: t.text },
    { v: offers.length, l: "عروض جديدة", go: goOffers, c: t.gold },
    { v: doneCount, l: "مكتملة", go: () => goBookings(), c: STATE_META.done.color },
  ];
  const recent = states.slice(0, 3);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={loadingBookings} onRefresh={refreshAll} tintColor={t.gold} />}
      >
        <View style={{ backgroundColor: t.hdr, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, paddingTop: insets.top + 12, paddingBottom: 22, paddingHorizontal: 20 }}>
          <View style={{ alignItems: "center", justifyContent: "center", height: 52 }}>
            <Image source={t.isDark ? LOGO_DARK : LOGO_LIGHT} style={{ height: 44, width: 150 }} contentFit="contain" />
          </View>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, marginTop: 14 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: t.ic, borderWidth: 1.5, borderColor: t.goldRing, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {provider.photo_url ? (
                <Image source={{ uri: provider.photo_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <PText style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 21 }}>{initialOf(provider.name)}</PText>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "right" }}>أهلًا بك</PText>
              <PText numberOfLines={1} style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 18, textAlign: "right" }}>{provider.name}</PText>
            </View>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 14, backgroundColor: t.card, borderWidth: 1, borderColor: t.border }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: available ? t.online : t.offline }} />
              <PText style={{ color: t.text, fontFamily: TJ.bold, fontSize: 13 }}>{available ? "متاح" : "غير متاح"}</PText>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <View style={{ marginTop: 16, backgroundColor: t.goldTint, borderWidth: 1, borderColor: t.goldRing, borderRadius: 24, padding: 16, flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <PText style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 13, textAlign: "right" }}>الخطوة التالية</PText>
              <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 16, marginTop: 4, textAlign: "right", lineHeight: 23 }}>{smart.t}</PText>
              <PText style={{ color: t.text2, fontFamily: TJ.medium, fontSize: 13.5, marginTop: 3, textAlign: "right", lineHeight: 20 }}>{smart.s}</PText>
            </View>
            {smart.a ? (
              <Pressable onPress={smart.go} style={({ pressed }) => ({ backgroundColor: t.gold, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
                <PText style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 14 }}>{smart.a}</PText>
              </Pressable>
            ) : null}
          </View>

          <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 12 }}>
            {stats.map((s) => (
              <Pressable key={s.l} onPress={s.go} style={({ pressed }) => ({ flex: 1, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 6, alignItems: "center", transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                <PText style={{ color: s.c, fontFamily: TJ.heavy, fontSize: 26 }}>{s.v}</PText>
                <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, marginTop: 3 }}>{s.l}</PText>
              </Pressable>
            ))}
          </View>

          <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 17, textAlign: "right", marginTop: 26, marginBottom: 12, marginHorizontal: 4 }}>جدول اليوم</PText>
          <View style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 22, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 6 }}>
            {timeline.map(({ slot, items }) => (
              <View key={slot} style={{ flexDirection: "row-reverse", gap: 12, marginBottom: 10 }}>
                <View style={{ width: 54, alignItems: "center", paddingTop: 4 }}>
                  <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 14 }}>{PERIOD_LABEL[slot]}</PText>
                  <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13 }}>{PERIOD_HOURS[slot]}</PText>
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  {items.map(({ b, s }) => {
                    const m = STATE_META[s];
                    const icon = s === "done" ? "✓" : s === "onway" ? "➤" : "◷";
                    return (
                      <Pressable key={b.id} onPress={() => goBookings(b.id)}
                        style={{ backgroundColor: m.color + "26", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 }}>
                        <PText numberOfLines={1} style={{ color: m.color, fontFamily: TJ.bold, fontSize: 14, textAlign: "right" }}>
                          {icon} {shortName(b.patient_name)} · {b.sub_option ?? b.service_type}
                        </PText>
                      </Pressable>
                    );
                  })}
                  {items.length === 0 ? (
                    <View style={{ borderWidth: 1.5, borderStyle: "dashed", borderColor: t.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 }}>
                      <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "right" }}>لا توجد زيارات</PText>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "baseline", marginTop: 26, marginBottom: 10, marginHorizontal: 4 }}>
            <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 17 }}>آخر حجوزاتي</PText>
            <Pressable onPress={() => goBookings()}>
              <PText style={{ color: t.gold, fontFamily: TJ.bold, fontSize: 14 }}>عرض الكل ←</PText>
            </Pressable>
          </View>
          <View style={{ gap: 8 }}>
            {recent.map(({ b, s }) => {
              const m = STATE_META[s];
              return (
                <Pressable key={b.id} onPress={() => goBookings(b.id)}
                  style={({ pressed }) => ({ backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 20, padding: 12, flexDirection: "row-reverse", alignItems: "center", gap: 12, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
                  <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: t.ic, alignItems: "center", justifyContent: "center" }}>
                    <PText style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 16 }}>{initialOf(b.patient_name)}</PText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <PText numberOfLines={1} style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 14.5, textAlign: "right" }}>{shortName(b.patient_name)}</PText>
                    <PText numberOfLines={1} style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13, marginTop: 2, textAlign: "right" }}>
                      {b.sub_option ?? b.service_type} · {b.area ?? "—"}
                    </PText>
                  </View>
                  <View style={{ backgroundColor: m.color + "26", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <PText style={{ color: m.color, fontFamily: TJ.bold, fontSize: 12.5 }}>{m.label}</PText>
                  </View>
                </Pressable>
              );
            })}
            {recent.length === 0 ? (
              <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "center", paddingVertical: 26 }}>لا توجد حجوزات بعد</PText>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
