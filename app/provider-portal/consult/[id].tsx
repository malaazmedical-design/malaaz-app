import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConsultRoom } from "@/components/consult/ConsultRoom";
import { PText } from "@/components/provider/PUI";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { dateTimeLabel, dayLabel, FOLLOW_LABEL, PAY_LABEL, PERIOD_LABEL, STAGE_META, stageOf, timeLabel } from "@/lib/consult";
import { shortName } from "@/lib/providerFmt";
import { supabase, DbConsultation } from "@/lib/supabase";

// أوقات مقترحة داخل فترة العميل (كل 30 دقيقة)
function slotsFor(c: DbConsultation): Date[] {
  const out: Date[] = [];
  const now = Date.now();
  if (c.period === "asap") {
    const s = new Date(Math.ceil((now + 10 * 60000) / (15 * 60000)) * 15 * 60000);
    for (let i = 0; i < 8; i++) out.push(new Date(s.getTime() + i * 15 * 60000));
    return out;
  }
  const [y, m, d] = c.period_date.split("-").map(Number);
  const [sh, eh] = c.period === "morning" ? [8, 12] : c.period === "noon" ? [12, 16] : [16, 21];
  for (let h = sh; h < eh; h++) for (const mm of [0, 30]) {
    const dt = new Date(y, m - 1, d, h, mm, 0, 0);
    if (dt.getTime() > now + 5 * 60000) out.push(dt);
  }
  return out;
}

export default function ProviderConsultation() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const webTop = Platform.OS === "web" ? 67 : 0;
  const [c, setC] = useState<DbConsultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);
  const [slot, setSlot] = useState<Date | null>(null);
  const [note, setNote] = useState("");
  const [recs, setRecs] = useState("");
  const [follow, setFollow] = useState<"none" | "week" | "two" | "month">("none");

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("consultations").select("*").eq("id", id).single();
    setC((data as DbConsultation) ?? null);
    setLoading(false);
    setRefreshing(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const iv = setInterval(() => setTick((x) => x + 1), 15000); return () => clearInterval(iv); }, []);
  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`pconsult_${id}_${Date.now()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "consultations", filter: `id=eq.${id}` }, (p) => setC((prev) => (prev ? { ...prev, ...(p.new as DbConsultation) } : (p.new as DbConsultation))))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  const slots = useMemo(() => (c ? slotsFor(c) : []), [c]);

  const call = async (fn: string, args: Record<string, unknown>) => {
    setBusy(true);
    const { data, error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error || (data && data !== "ok")) {
      const m: Record<string, string> = { early: "زر البدء بيفتح قبل الموعد بـ 10 دقائق", outside: "اختر وقتًا داخل فترة المريض", pending: "بانتظار رد المريض على الموعد السابق", past: "اختر وقتًا لاحقًا", locked: "لا يمكن تنفيذ هذا الإجراء الآن" };
      Alert.alert("", error?.message ?? m[String(data)] ?? "تعذّر تنفيذ الطلب");
      return false;
    }
    load();
    return true;
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={t.gold} /></View>;
  if (!c) return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}><PText style={{ color: t.muted, fontFamily: TJ.medium }}>الاستشارة غير موجودة</PText></View>;

  const stage = stageOf(c);
  const meta = STAGE_META[stage];
  const card = { backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 20, padding: 16 } as const;
  const body = (txt: string, color = t.text2) => <PText style={{ color, fontFamily: TJ.medium, fontSize: 14.5, lineHeight: 24, textAlign: "right" }}>{txt}</PText>;
  const head = (txt: string, color = t.text) => <PText style={{ color, fontFamily: TJ.heavy, fontSize: 16, textAlign: "right", marginBottom: 6 }}>{txt}</PText>;
  const btn = (label: string, onPress: () => void, opts: { kind?: "gold" | "ghost"; disabled?: boolean } = {}) => (
    <Pressable onPress={onPress} disabled={busy || opts.disabled}
      style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: opts.kind === "ghost" ? "transparent" : t.gold, borderWidth: opts.kind === "ghost" ? 1.5 : 0, borderColor: t.border, opacity: opts.disabled ? 0.45 : pressed || busy ? 0.85 : 1 })}>
      <PText style={{ color: opts.kind === "ghost" ? t.text : t.onGold, fontFamily: TJ.heavy, fontSize: 15 }}>{label}</PText>
    </Pressable>
  );

  const header = (
    <View style={{ paddingTop: insets.top + 12 + webTop, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
      <Pressable onPress={() => router.back()} accessibilityLabel="رجوع" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name="arrow-right" size={22} color={t.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <PText style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 19, textAlign: "right" }}>{shortName(c.client_name ?? "")}</PText>
        <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right" }}>استشارة أونلاين · {c.case_number}</PText>
      </View>
      <View style={{ backgroundColor: meta.color + "26", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}>
        <PText style={{ color: meta.color, fontFamily: TJ.bold, fontSize: 12.5 }}>{meta.doctor}</PText>
      </View>
    </View>
  );

  if (stage === "live") return <View style={{ flex: 1, backgroundColor: t.bg }}>{header}<ConsultRoom c={c} role="d" onChanged={load} /></View>;

  const apptMs = c.appt_at ? new Date(c.appt_at).getTime() : 0;
  const canStart = c.prop_status === "ok" && apptMs - Date.now() <= 10 * 60000;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={t.gold} />}>
        <View style={card}>
          <View style={{ flexDirection: "row-reverse", justifyContent: "space-between" }}>
            <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13 }}>الفترة</PText>
            <PText style={{ color: t.text, fontFamily: TJ.bold, fontSize: 13.5 }}>{c.period === "asap" ? PERIOD_LABEL.asap : `${dayLabel(c.period_date)} · ${PERIOD_LABEL[c.period]}`}</PText>
          </View>
          <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 6 }}>
            <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13 }}>القناة والمدة</PText>
            <PText style={{ color: t.text, fontFamily: TJ.bold, fontSize: 13.5 }}>شات · {c.duration_min + c.extra_min} دقيقة</PText>
          </View>
          <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 6 }}>
            <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13 }}>الدفع</PText>
            <PText style={{ color: t.text, fontFamily: TJ.bold, fontSize: 13.5 }}>{c.pay_method ? PAY_LABEL[c.pay_method] : "—"} · {c.price} ج.م</PText>
          </View>
        </View>

        {stage === "pay_pending" ? <View style={card}>{head("في انتظار الدفع")}{body("الإدارة بتتواصل مع المريض لتأكيد الدفع. هيوصلك إشعار لما يتم الدفع ثم تحدد الموعد.")}</View> : null}
        {stage === "cancelled" ? <View style={[card, { borderColor: "rgba(229,72,77,.5)" }]}>{head("تم الإلغاء", t.destructive)}{body(`السبب: ${c.cancel_reason ?? "—"}`)}</View> : null}

        {stage === "need_time" || stage === "time_rejected" ? (
          <View style={[card, { borderColor: t.gold, borderWidth: 1.5 }]}>
            {head(stage === "time_rejected" ? "المريض لا يناسبه الموعد" : "تم الدفع · حدد الموعد", stage === "time_rejected" ? t.destructive : t.text)}
            {stage === "time_rejected" ? body("الإدارة هتتواصل مع المريض، وبعدها تقدر تقترح موعدًا جديدًا.") : body("اختر وقتًا داخل فترة المريض، وهيوصله للموافقة.")}
            {stage === "need_time" ? (
              <>
                <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {slots.length === 0 ? body("انتهت هذه الفترة. تواصل مع الإدارة.") : slots.map((s) => {
                    const on = slot?.getTime() === s.getTime();
                    return (
                      <Pressable key={s.getTime()} onPress={() => setSlot(s)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: on ? t.gold : t.border, backgroundColor: on ? t.goldTint : t.ic }}>
                        <PText style={{ color: on ? t.goldText : t.text2, fontFamily: TJ.heavy, fontSize: 14 }}>{timeLabel(s.toISOString())}</PText>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={{ flexDirection: "row-reverse", marginTop: 14 }}>
                  {btn("إرسال الموعد للمريض", () => slot && call("propose_consultation_time", { p_id: c.id, p_at: slot.toISOString() }), { disabled: !slot })}
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {stage === "time_pending" && c.prop_at ? (
          <View style={card}>{head("تم الإرسال · في انتظار التأكيد")}<PText style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 19, textAlign: "right" }}>{dateTimeLabel(c.prop_at)}</PText></View>
        ) : null}

        {(stage === "scheduled" || stage === "doctor_late") && c.appt_at ? (
          <View style={[card, { borderColor: stage === "doctor_late" ? "rgba(229,72,77,.5)" : t.gold, borderWidth: 1.5 }]}>
            {head(stage === "doctor_late" ? "تأخرت عن موعد الاستشارة. ابدأها الآن" : "الموعد المعتمد", stage === "doctor_late" ? t.destructive : t.text)}
            <PText style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 20, textAlign: "right" }}>{dateTimeLabel(c.appt_at)}</PText>
            {!canStart ? <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13, textAlign: "right", marginTop: 8 }}>يفتح زر البدء قبل الموعد بـ 10 دقائق</PText> : null}
            <View style={{ flexDirection: "row-reverse", marginTop: 14 }}>
              {btn("ابدأ الجلسة", () => call("start_consultation", { p_id: c.id }), { disabled: !canStart })}
            </View>
          </View>
        ) : null}

        {stage === "need_summary" ? (
          <View style={[card, { borderColor: t.gold, borderWidth: 1.5 }]}>
            {head("اكتب ملخص الاستشارة")}
            <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginBottom: 8 }}>بدون أدوية أو روشتة — الاستشارة ليست كشفًا.</PText>
            <TextInput value={note} onChangeText={setNote} multiline textAlign="right" placeholder="ملاحظات الطبيب" placeholderTextColor={t.muted}
              style={{ minHeight: 90, backgroundColor: t.ic, borderRadius: 14, padding: 12, color: t.text, fontFamily: TJ.medium, fontSize: 14.5, textAlignVertical: "top" }} />
            <TextInput value={recs} onChangeText={setRecs} multiline textAlign="right" placeholder="التوصيات" placeholderTextColor={t.muted}
              style={{ minHeight: 70, backgroundColor: t.ic, borderRadius: 14, padding: 12, color: t.text, fontFamily: TJ.medium, fontSize: 14.5, textAlignVertical: "top", marginTop: 8 }} />
            <PText style={{ color: t.muted, fontFamily: TJ.bold, fontSize: 13, textAlign: "right", marginTop: 12, marginBottom: 6 }}>المتابعة</PText>
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
              {(["none", "week", "two", "month"] as const).map((k) => (
                <Pressable key={k} onPress={() => setFollow(k)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, borderWidth: 1.5, borderColor: follow === k ? t.gold : t.border, backgroundColor: follow === k ? t.goldTint : t.ic }}>
                  <PText style={{ color: follow === k ? t.goldText : t.text2, fontFamily: TJ.heavy, fontSize: 13 }}>{FOLLOW_LABEL[k]}</PText>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row-reverse", marginTop: 14 }}>
              {btn("إرسال الملخص", () => (note.trim().length >= 3 ? call("submit_consultation_summary", { p_id: c.id, p_note: note, p_recs: recs, p_follow: follow }) : Alert.alert("", "اكتب ملاحظاتك أولاً")))}
            </View>
          </View>
        ) : null}

        {stage === "no_show" ? <View style={card}>{head("لم يحضر المريض")}{body("انتهت الجلسة بدون ملخص.")}</View> : null}

        {stage === "done" ? (
          <>
            <View style={card}>
              {head("ملخصك")}
              {body(c.sum_note ?? "")}
              {c.sum_recs ? body(`التوصيات: ${c.sum_recs}`) : null}
              <PText style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 13.5, textAlign: "right", marginTop: 8 }}>المتابعة: {FOLLOW_LABEL[c.sum_follow]}</PText>
            </View>
            <View style={card}>
              {head("تقييم المريض")}
              {c.rating ? (
                c.rating_ok ? (
                  <>
                    <PText style={{ color: t.goldText, fontSize: 24, textAlign: "right" }}>{"★".repeat(c.rating)}{"☆".repeat(5 - c.rating)}</PText>
                    {c.rating_text ? body(c.rating_text) : null}
                  </>
                ) : body("تقييم المريض قيد مراجعة الإدارة")
              ) : body("لم يقيّم المريض بعد")}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
