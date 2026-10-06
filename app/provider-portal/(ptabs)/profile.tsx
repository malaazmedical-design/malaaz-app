import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PText } from "@/components/provider/PUI";
import { Group, GoldButton, Row } from "@/components/account/AccountUI";
import { TJ, setThemeOverride, useMalaz } from "@/constants/malazTheme";
import { useProvider } from "@/contexts/ProviderContext";
import { callCompany, whatsappCompany } from "@/lib/contact";
import { initialOf } from "@/lib/providerFmt";
import { FontSize, Lang, setProviderPref, useProviderPrefs } from "@/lib/providerPrefs";

const FS_OPTS: { k: FontSize; name: string }[] = [
  { k: "n", name: "عادي" },
  { k: "l", name: "كبير" },
  { k: "xl", name: "أكبر" },
];

function titleLine(p: { service_type: string; grade: string | null; specialty: string | null }) {
  if (p.service_type.includes("تمريض")) return p.grade || "أخصائي تمريض";
  if (p.service_type.includes("أشعة")) return "مركز أشعة";
  return [p.grade, p.specialty].filter(Boolean).join(" · ") || "طبيب";
}

export default function ProviderProfileScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { provider, myServices, toggleAvailability, logout } = useProvider();
  const prefs = useProviderPrefs();
  const [sheet, setSheet] = useState<null | "lang" | "support" | "logout">(null);

  if (!provider) return null;
  const available = provider.is_available ?? false;
  const onCount = myServices.filter((s) => s.is_active).length;

  const flip = async (v: boolean) => {
    try { await toggleAvailability(v); } catch (e: any) { Alert.alert("خطأ", e.message ?? "تعذر التحديث"); }
  };

  const doLogout = async () => {
    setSheet(null);
    await logout();
    router.replace("/provider-portal/login");
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 16, paddingBottom: 30 }}>
        <View style={{ alignItems: "center" }}>
          <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: t.ic, borderWidth: 3, borderColor: t.goldRing, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {provider.photo_url ? (
              <Image source={{ uri: provider.photo_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <PText style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 44 }}>{initialOf(provider.name)}</PText>
            )}
          </View>
          <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 22, marginTop: 12 }}>{provider.name}</PText>
          <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14.5, marginTop: 2 }}>{titleLine(provider)}</PText>
        </View>

        <Pressable
          onPress={() => router.push("/provider-portal/edit-account")}
          style={({ pressed }) => ({ marginTop: 16, borderWidth: 1.5, borderColor: t.gold, borderRadius: 16, paddingVertical: 13, alignItems: "center", transform: [{ scale: pressed ? 0.98 : 1 }] })}
        >
          <PText style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 15 }}>تعديل الحساب</PText>
        </Pressable>

        <Group label="الإعدادات">
          <Row icon="circle-half-full" title="متاح للحجوزات" value={available ? "العملاء يرونك ويستطيعون الحجز" : "أنت مخفي عن نتائج البحث"}
            toggle={{ on: available, onChange: flip }} />
          <Row icon="bell-outline" title="الإشعارات" value={prefs.notifications ? "مفعّلة" : "متوقفة"}
            toggle={{ on: prefs.notifications, onChange: (v) => setProviderPref("notifications", v) }} />
          <Row icon="weather-night" title="الوضع الداكن" value={t.isDark ? "مفعّل" : "متوقف"}
            toggle={{ on: t.isDark, onChange: (v) => setThemeOverride(v ? "dark" : "light") }} />
          <Row icon="translate" title="اللغة" value={prefs.lang === "ar" ? "العربية" : "English"} onPress={() => setSheet("lang")} />
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: t.border }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: t.ic, alignItems: "center", justifyContent: "center" }}>
              <PText style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 17 }}>أ</PText>
            </View>
            <PText style={{ flex: 1, color: t.text, fontFamily: TJ.bold, fontSize: 14.5, textAlign: "right" }}>حجم الخط</PText>
            <View style={{ flexDirection: "row-reverse", gap: 6 }}>
              {FS_OPTS.map((o) => {
                const on = prefs.fontSize === o.k;
                return (
                  <Pressable key={o.k} onPress={() => setProviderPref("fontSize", o.k)}
                    style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12, backgroundColor: on ? t.gold : t.btn }}>
                    <PText style={{ color: on ? t.onGold : t.text2, fontFamily: TJ.bold, fontSize: 13 }}>{o.name}</PText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Row icon="view-grid-outline" title="خدماتي وأسعاري" value={`${onCount} خدمات مفعّلة`} onPress={() => router.push("/provider-portal/(ptabs)/services")} last />
        </Group>

        <Group label="المساعدة">
          <Row icon="phone-outline" title="تواصل مع الدعم" value="نرد على استفسارك" onPress={() => setSheet("support")} last />
        </Group>

        <Pressable
          onPress={() => setSheet("logout")}
          style={({ pressed }) => ({ marginTop: 14, borderWidth: 1.5, borderColor: "rgba(229,72,77,.5)", borderRadius: 18, paddingVertical: 14, alignItems: "center", transform: [{ scale: pressed ? 0.98 : 1 }] })}
        >
          <PText style={{ color: t.destructive, fontFamily: TJ.heavy, fontSize: 15 }}>تسجيل الخروج</PText>
        </Pressable>
      </ScrollView>

      <Modal visible={sheet !== null} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,.55)", justifyContent: "flex-end" }} onPress={() => setSheet(null)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: t.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: insets.bottom + 20, gap: 10 }}>
            {sheet === "lang" ? (
              <>
                <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 18, textAlign: "right", marginBottom: 4 }}>اللغة</PText>
                {([["ar", "العربية"], ["en", "English"]] as [Lang, string][]).map(([k, name]) => {
                  const on = prefs.lang === k;
                  return (
                    <Pressable key={k} onPress={() => { setProviderPref("lang", k); setSheet(null); }}
                      style={{ flexDirection: "row-reverse", justifyContent: "space-between", padding: 15, borderRadius: 16, backgroundColor: on ? t.goldTint : t.ic, borderWidth: 1, borderColor: on ? t.gold : "transparent" }}>
                      <PText style={{ color: t.text, fontFamily: TJ.bold, fontSize: 15 }}>{name}</PText>
                      {on ? <PText style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 16 }}>✓</PText> : null}
                    </Pressable>
                  );
                })}
                <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right" }}>الواجهة بالعربية حاليًا، والإنجليزية قريبًا.</PText>
              </>
            ) : null}
            {sheet === "support" ? (
              <>
                <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 18, textAlign: "right", marginBottom: 4 }}>تواصل مع الدعم</PText>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <Pressable onPress={() => whatsappCompany("مرحباً، أنا مقدم خدمة في ملاذ وعندي استفسار")} style={{ flex: 1, alignItems: "center", padding: 14, borderRadius: 14, backgroundColor: "rgba(37,211,102,.14)" }}>
                    <PText style={{ color: t.whatsapp, fontFamily: TJ.heavy, fontSize: 15 }}>واتساب</PText>
                  </Pressable>
                  <Pressable onPress={callCompany} style={{ flex: 1, alignItems: "center", padding: 14, borderRadius: 14, backgroundColor: t.btn }}>
                    <PText style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 15 }}>اتصال</PText>
                  </Pressable>
                </View>
              </>
            ) : null}
            {sheet === "logout" ? (
              <>
                <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 18, textAlign: "right" }}>تسجيل الخروج</PText>
                <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "right", marginBottom: 6 }}>هل تريد تسجيل الخروج من حسابك؟</PText>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <GoldButton label="إلغاء" outline flex onPress={() => setSheet(null)} />
                  <Pressable onPress={doLogout} style={{ flex: 1, height: 50, borderRadius: 16, backgroundColor: t.destructive, alignItems: "center", justifyContent: "center" }}>
                    <PText style={{ color: "#fff", fontFamily: TJ.heavy, fontSize: 15 }}>خروج</PText>
                  </Pressable>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
