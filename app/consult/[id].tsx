import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConsultRoom } from "@/components/consult/ConsultRoom";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { whatsappCompany } from "@/lib/contact";
import { dateTimeLabel, dayLabel, FOLLOW_LABEL, PAY_LABEL, PERIOD_LABEL, STAGE_META, stageOf, timeLabel } from "@/lib/consult";
import { supabase, DbConsultation } from "@/lib/supabase";

export default function ClientConsultation() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const webTop = Platform.OS === "web" ? 67 : 0;
  const [c, setC] = useState<DbConsultation | null>(null);
  const [doc, setDoc] = useState<{ name: string; specialty: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);
  const [stars, setStars] = useState(0);
  const [rtext, setRtext] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("consultations").select("*").eq("id", id).single();
    const row = (data as DbConsultation) ?? null;
    setC(row);
    if (row && !doc) {
      const { data: p } = await supabase.from("providers").select("name,specialty").eq("id", row.provider_id).single();
      if (p) setDoc(p as any);
    }
    setLoading(false);
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const iv = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(iv); }, []);
  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`consult_${id}_${Date.now()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "consultations", filter: `id=eq.${id}` }, (p) => setC((prev) => (prev ? { ...prev, ...(p.new as DbConsultation) } : (p.new as DbConsultation))))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  const call = async (fn: string, args: Record<string, unknown>, okMsg?: string) => {
    setBusy(true);
    const { data, error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error || (data && data !== "ok")) { Alert.alert("", error?.message ?? "تعذّر تنفيذ الطلب"); return; }
    if (okMsg) Alert.alert("", okMsg);
    load();
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={t.gold} /></View>;
  if (!c) return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}><Text style={{ color: t.muted, fontFamily: TJ.medium }}>الاستشارة غير موجودة</Text></View>;

  const stage = stageOf(c);
  const meta = STAGE_META[stage];
  const docName = doc ? (doc.name.startsWith("د") ? doc.name : `د. ${doc.name}`) : "الطبيب";
  const card = { backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 20, padding: 16 } as const;
  const body = (txt: string, color = t.text2) => <Text style={{ color, fontFamily: TJ.medium, fontSize: 14.5, lineHeight: 24, textAlign: "right" }}>{txt}</Text>;
  const head = (txt: string, color = t.text) => <Text style={{ color, fontFamily: TJ.heavy, fontSize: 16, textAlign: "right", marginBottom: 6 }}>{txt}</Text>;
  const btn = (label: string, onPress: () => void, kind: "gold" | "ghost" | "bad" = "gold", icon?: any) => (
    <Pressable onPress={onPress} disabled={busy}
      style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 16, flexDirection: "row-reverse", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: kind === "gold" ? t.gold : "transparent", borderWidth: kind === "gold" ? 0 : 1.5, borderColor: kind === "bad" ? "rgba(229,72,77,.5)" : t.border, opacity: pressed || busy ? 0.85 : 1 })}>
      {icon ? <MaterialCommunityIcons name={icon} size={20} color={kind === "gold" ? t.onGold : t.text} /> : null}
      <Text style={{ color: kind === "gold" ? t.onGold : kind === "bad" ? t.destructive : t.text, fontFamily: TJ.heavy, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );

  const header = (
    <View style={{ paddingTop: insets.top + 12 + webTop, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
      <Pressable onPress={() => router.back()} accessibilityLabel="رجوع" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name="arrow-right" size={22} color={t.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 19, textAlign: "right" }}>استشارة أونلاين</Text>
        <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right" }}>{docName} · {c.case_number}</Text>
      </View>
      <View style={{ backgroundColor: meta.color + "26", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}>
        <Text style={{ color: meta.color, fontFamily: TJ.bold, fontSize: 12.5 }}>{meta.client}</Text>
      </View>
    </View>
  );

  if (stage === "live") {
    return <View style={{ flex: 1, backgroundColor: t.bg }}>{header}<ConsultRoom c={c} role="c" onChanged={load} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={t.gold} />}>

        {/* ملخص الحجز */}
        <View style={card}>
          <View style={{ flexDirection: "row-reverse", justifyContent: "space-between" }}>
            <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13 }}>القناة</Text>
            <Text style={{ color: t.text, fontFamily: TJ.bold, fontSize: 13.5 }}>شات · {c.duration_min + c.extra_min} دقيقة</Text>
          </View>
          <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13 }}>الفترة</Text>
            <Text style={{ color: t.text, fontFamily: TJ.bold, fontSize: 13.5 }}>{c.period === "asap" ? PERIOD_LABEL.asap : `${dayLabel(c.period_date)} · ${PERIOD_LABEL[c.period]}`}</Text>
          </View>
          <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13 }}>الدفع</Text>
            <Text style={{ color: t.text, fontFamily: TJ.bold, fontSize: 13.5 }}>{c.pay_method ? PAY_LABEL[c.pay_method] : "—"}</Text>
          </View>
          <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13 }}>المبلغ</Text>
            <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 15 }}>{c.price} ج.م</Text>
          </View>
        </View>

        {stage === "pay_pending" ? (
          <View style={card}>
            {head("في انتظار الدفع")}
            {body("الإدارة هتتواصل معاك على الموبايل أو واتساب لتحويل المبلغ. الحجز مش هيبدأ قبل تأكيد الدفع.")}
            {c.pay_deadline ? <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginTop: 8 }}>مهلة الدفع: {dateTimeLabel(c.pay_deadline)}</Text> : null}
            <View style={{ flexDirection: "row-reverse", marginTop: 14 }}>
              {btn("تواصل مع الإدارة", () => whatsappCompany(`مرحباً، أريد إتمام دفع الاستشارة ${c.case_number} (${c.price} ج.م)`), "gold", "whatsapp")}
            </View>
          </View>
        ) : null}

        {stage === "cancelled" ? (
          <View style={[card, { borderColor: "rgba(229,72,77,.5)" }]}>
            {head("تم إلغاء الاستشارة", t.destructive)}
            {body(`السبب: ${c.cancel_reason ?? "—"}`)}
            {c.refunded ? <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginTop: 6 }}>سيتم رد المبلغ</Text> : null}
          </View>
        ) : null}

        {stage === "need_time" ? (
          <View style={card}>{head("تم الدفع ✓")}{body(`${docName} هيحدد موعدًا داخل الفترة اللي اخترتها، وهيوصلك إشعار للموافقة.`)}</View>
        ) : null}

        {stage === "time_pending" && c.prop_at ? (
          <View style={[card, { borderColor: t.gold, borderWidth: 1.5 }]}>
            {head("اقترح الطبيب موعدًا")}
            <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 20, textAlign: "right" }}>{dateTimeLabel(c.prop_at)}</Text>
            <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 14 }}>
              {btn("موافق", () => call("respond_consultation_time", { p_id: c.id, p_accept: true }), "gold", "check")}
              {btn("لا يناسبني", () => call("respond_consultation_time", { p_id: c.id, p_accept: false }), "ghost")}
            </View>
          </View>
        ) : null}

        {stage === "time_rejected" ? (
          <View style={card}>{head("بانتظار موعد جديد")}{body("الإدارة هتتواصل معاك لتحديد موعد مناسب.")}</View>
        ) : null}

        {(stage === "scheduled" || stage === "doctor_late") && c.appt_at ? (
          <View style={[card, { borderColor: stage === "doctor_late" ? "rgba(229,72,77,.5)" : t.gold, borderWidth: 1.5 }]}>
            {head(stage === "doctor_late" ? "تأخر الطبيب قليلًا · الإدارة تتابع" : "موعد استشارتك", stage === "doctor_late" ? t.destructive : t.text)}
            <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 20, textAlign: "right" }}>{dateTimeLabel(c.appt_at)}</Text>
            {body(`هيوصلك تنبيه قبل الموعد بـ 30 و10 دقائق. الطبيب هو اللي بيبدأ الجلسة وهيجيلك إشعار تدخل منه.`)}
          </View>
        ) : null}

        {stage === "need_summary" ? (
          <View style={card}>{head("انتهت الاستشارة")}{body("بانتظار ملخص الطبيب. هيوصلك إشعار.")}</View>
        ) : null}

        {stage === "no_show" ? (
          <View style={card}>
            {head("لم تحضر الجلسة")}
            {body("يمكنك حجز موعد جديد مع نفس الطبيب.")}
            <View style={{ flexDirection: "row-reverse", marginTop: 12 }}>{btn("احجز موعدًا جديدًا", () => router.replace(`/consult/book?provider=${c.provider_id}`))}</View>
          </View>
        ) : null}

        {stage === "done" ? (
          <>
            <View style={card}>
              {head("ملخص الاستشارة")}
              {body(c.sum_note ?? "")}
              {c.sum_recs ? <><Text style={{ color: t.muted, fontFamily: TJ.bold, fontSize: 12.5, textAlign: "right", marginTop: 12 }}>التوصيات</Text>{body(c.sum_recs)}</> : null}
              <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 13.5, textAlign: "right", marginTop: 12 }}>المتابعة: {FOLLOW_LABEL[c.sum_follow]}</Text>
              {c.sum_follow !== "none" ? (
                <View style={{ flexDirection: "row-reverse", marginTop: 12 }}>{btn(`احجز متابعة مع ${docName}`, () => router.push(`/consult/book?provider=${c.provider_id}`), "ghost")}</View>
              ) : null}
            </View>

            <View style={card}>
              {head("قيّم الاستشارة")}
              {c.rating ? (
                <>
                  <Text style={{ color: t.goldText, fontSize: 26, textAlign: "right" }}>{"★".repeat(c.rating)}{"☆".repeat(5 - c.rating)}</Text>
                  {c.rating_text ? body(c.rating_text) : null}
                  <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginTop: 6 }}>{c.rating_ok ? "تم اعتماد تقييمك" : "تقييمك قيد مراجعة الإدارة"}</Text>
                </>
              ) : (
                <>
                  <View style={{ flexDirection: "row-reverse", gap: 6, marginBottom: 10 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Pressable key={n} onPress={() => setStars(n)} hitSlop={6}><Text style={{ fontSize: 34, color: n <= stars ? t.gold : t.border }}>★</Text></Pressable>
                    ))}
                  </View>
                  <TextInput value={rtext} onChangeText={setRtext} multiline textAlign="right" placeholder="تعليق (اختياري)" placeholderTextColor={t.muted}
                    style={{ minHeight: 70, backgroundColor: t.ic, borderRadius: 14, padding: 12, color: t.text, fontFamily: TJ.medium, fontSize: 14.5, textAlignVertical: "top" }} />
                  <View style={{ flexDirection: "row-reverse", marginTop: 12 }}>
                    {btn("إرسال التقييم", () => (stars ? call("rate_consultation", { p_id: c.id, p_stars: stars, p_text: rtext }) : Alert.alert("", "اختر عدد النجوم")))}
                  </View>
                </>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
