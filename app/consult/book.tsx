import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProviderAvatar } from "@/components/ProviderAvatar";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { useApp } from "@/contexts/AppContext";
import { PAY_LABEL, PERIOD_LABEL } from "@/lib/consult";
import { supabase } from "@/lib/supabase";

type Prov = { id: string; name: string; specialty: string | null; grade: string | null; photo_url: string | null };
const PERIOD_END_HOUR: Record<string, number> = { morning: 12, noon: 16, evening: 21 };

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function BookConsultation() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { client } = useApp();
  const { provider: providerId } = useLocalSearchParams<{ provider: string }>();
  const webTop = Platform.OS === "web" ? 67 : 0;
  const [prov, setProv] = useState<Prov | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [dur, setDur] = useState(15);
  const [loading, setLoading] = useState(true);
  const [dayIdx, setDayIdx] = useState(0);
  const [period, setPeriod] = useState<string>("asap");
  const [pay, setPay] = useState<"wallet" | "instapay">("wallet");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!providerId) return;
      const { data: p } = await supabase.from("providers").select("id,name,specialty,grade,photo_url").eq("id", providerId).single();
      setProv(p as Prov);
      const { data: subs } = await supabase.from("sub_services").select("id").eq("group_name", "online");
      const ids = (subs ?? []).map((s: any) => s.id);
      if (ids.length) {
        const { data: ps } = await supabase.from("provider_services").select("custom_price,duration_min").eq("provider_id", providerId).in("sub_service_id", ids).eq("is_active", true).limit(1);
        if (ps?.[0]) { setPrice(ps[0].custom_price); setDur(ps[0].duration_min ?? 15); }
      }
      setLoading(false);
    })();
  }, [providerId]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; }), []);
  const periodOk = (k: string) => {
    if (k === "asap") return dayIdx === 0;
    const end = new Date(days[dayIdx]); end.setHours(PERIOD_END_HOUR[k], 0, 0, 0);
    return end.getTime() > Date.now() + 30 * 60000;
  };
  useEffect(() => { if (!periodOk(period)) setPeriod(["asap", "morning", "noon", "evening"].find(periodOk) ?? "morning"); /* eslint-disable-next-line */ }, [dayIdx]);

  const docName = prov ? (prov.name.startsWith("د") ? prov.name : `د. ${prov.name}`) : "";

  const confirm = async () => {
    if (!client) { setConsent(false); router.push("/client-auth"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("book_consultation", {
      p_provider: providerId, p_channel: "chat", p_date: ymd(days[dayIdx]), p_period: period, p_pay_method: pay,
    });
    setBusy(false);
    setConsent(false);
    if (error) { Alert.alert("تعذّر الحجز", error.message); return; }
    router.replace(`/consult/${data}`);
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={t.gold} /></View>;

  const section = (txt: string) => <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 16, textAlign: "right", marginTop: 22, marginBottom: 10 }}>{txt}</Text>;
  const chip = (on: boolean, disabled?: boolean) => ({
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5,
    borderColor: on ? t.gold : t.border, backgroundColor: on ? t.goldTint : t.card, opacity: disabled ? 0.4 : 1,
  } as const);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top + 12 + webTop, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="رجوع" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="arrow-right" size={22} color={t.text} />
        </Pressable>
        <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 21 }}>استشارة أونلاين</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }}>
        {prov ? (
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 20, padding: 14 }}>
            <ProviderAvatar provider={{ name: prov.name, avatar: prov.photo_url ? { uri: prov.photo_url } : undefined } as any} style={{ width: 54, height: 54, borderRadius: 27 }} letterSize={22} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 16.5, textAlign: "right" }}>{docName}</Text>
              <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13, textAlign: "right" }}>{[prov.grade, prov.specialty].filter(Boolean).join(" · ")}</Text>
            </View>
          </View>
        ) : null}

        {section("طريقة الاستشارة")}
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          {([["chat", "شات", "chat-outline", true], ["voice", "صوت", "phone-outline", false], ["video", "فيديو", "video-outline", false]] as const).map(([k, name, icon, on]) => (
            <View key={k} style={{ flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: on ? t.gold : t.border, backgroundColor: on ? t.goldTint : t.card, opacity: on ? 1 : 0.45 }}>
              <MaterialCommunityIcons name={icon} size={24} color={on ? t.goldText : t.muted} />
              <Text style={{ color: on ? t.text : t.muted, fontFamily: TJ.heavy, fontSize: 14, marginTop: 4 }}>{name}</Text>
              <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 11.5, marginTop: 2 }}>{on ? `${price ?? "—"} ج.م · ${dur} د` : "قريبًا"}</Text>
            </View>
          ))}
        </View>

        {section("اليوم")}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: "row-reverse" }}>
          {days.map((d, i) => (
            <Pressable key={i} onPress={() => setDayIdx(i)} style={chip(dayIdx === i)}>
              <Text style={{ color: dayIdx === i ? t.goldText : t.text2, fontFamily: TJ.heavy, fontSize: 13.5, textAlign: "center" }}>
                {i === 0 ? "اليوم" : i === 1 ? "غدًا" : d.toLocaleDateString("ar-EG", { weekday: "short" })}
              </Text>
              <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12, textAlign: "center" }}>{d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {section("الفترة")}
        <View style={{ gap: 8 }}>
          {(["asap", "morning", "noon", "evening"] as const).map((k) => {
            const ok = periodOk(k);
            if (k === "asap" && !ok) return null;
            return (
              <Pressable key={k} disabled={!ok} onPress={() => setPeriod(k)} style={[chip(period === k, !ok), { flexDirection: "row-reverse", alignItems: "center", gap: 10 }]}>
                <MaterialCommunityIcons name={period === k ? "radiobox-marked" : "radiobox-blank"} size={20} color={period === k ? t.goldText : t.muted} />
                <Text style={{ flex: 1, color: t.text, fontFamily: TJ.bold, fontSize: 14.5, textAlign: "right" }}>{PERIOD_LABEL[k]}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginTop: 8, lineHeight: 20 }}>
          الطبيب هيحدد موعدًا محددًا داخل الفترة اللي اخترتها وتوافق عليه.
        </Text>

        {section("طريقة الدفع")}
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          {(["wallet", "instapay"] as const).map((k) => (
            <Pressable key={k} onPress={() => setPay(k)} style={[chip(pay === k), { flex: 1, alignItems: "center" }]}>
              <Text style={{ color: pay === k ? t.goldText : t.text2, fontFamily: TJ.heavy, fontSize: 13.5, textAlign: "center" }}>{PAY_LABEL[k]}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginTop: 8, lineHeight: 20 }}>
          مفيش دفع جوه التطبيق. الإدارة هتتواصل معاك لتحويل المبلغ، ولا يبدأ الحجز قبل تأكيد الدفع.
        </Text>
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: insets.bottom + 16, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.border }}>
        <Pressable onPress={() => setConsent(true)} disabled={price == null}
          style={({ pressed }) => ({ height: 54, borderRadius: 18, backgroundColor: price == null ? t.btn : t.gold, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <Text style={{ color: price == null ? t.muted : t.onGold, fontFamily: TJ.heavy, fontSize: 16 }}>احجز مع {docName} الآن{price != null ? ` · ${price} ج.م` : ""}</Text>
        </Pressable>
      </View>

      <Modal visible={consent} transparent animationType="fade" onRequestClose={() => setConsent(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,.6)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: t.bg, borderRadius: 24, padding: 22, width: "100%", maxWidth: 380 }}>
            <MaterialCommunityIcons name="information-outline" size={32} color={t.goldText} style={{ alignSelf: "center" }} />
            <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 18, textAlign: "center", marginTop: 8 }}>قبل ما تكمّل</Text>
            <Text style={{ color: t.text2, fontFamily: TJ.medium, fontSize: 14.5, lineHeight: 24, textAlign: "center", marginTop: 8 }}>
              الاستشارة الأونلاين للمتابعة فقط وليست بديلًا عن الكشف.
            </Text>
            <Pressable onPress={confirm} disabled={busy} style={{ height: 52, borderRadius: 16, backgroundColor: t.gold, alignItems: "center", justifyContent: "center", marginTop: 18 }}>
              {busy ? <ActivityIndicator color={t.onGold} /> : <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 16 }}>تأكيد ومتابعة</Text>}
            </Pressable>
            <Pressable onPress={() => setConsent(false)} style={{ alignItems: "center", paddingTop: 14 }}>
              <Text style={{ color: t.muted, fontFamily: TJ.bold, fontSize: 14 }}>رجوع</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
