import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { TextInput } from "@/components/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SkeletonCards } from "@/components/Skeleton";
import { PText } from "@/components/provider/PUI";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { useProvider } from "@/contexts/ProviderContext";
import { supabase, AskInboxRow, DbAskDoctorAttachment } from "@/lib/supabase";

import { locale } from "@/lib/i18n";
// أسئلة المرضى اتنقلت جوه تبويب الحجوزات — الراوت ده بيحوّل ليه
export default function DoctorCasesRedirect() {
  return <Redirect href="/provider-portal/(ptabs)/bookings" />;
}

// صندوق أسئلة "إسأل طبيب": الأسئلة الموجّهة لتخصصي (لسه ماحدش جاوب) + ردودي
export function useDoctorCases() {
  const { provider } = useProvider();
  const [rows, setRows] = useState<AskInboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!provider?.id) { setLoading(false); return; }
    const { data } = await supabase.rpc("ask_doctor_inbox");
    setRows((data as AskInboxRow[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [provider?.id]);

  useEffect(() => { load(); }, [load]);
  // الدكتور مالوش صلاحية realtime على الجدول (بيانات المريض) فبنحدّث دوريًا
  useEffect(() => {
    const iv = setInterval(load, 25000);
    return () => clearInterval(iv);
  }, [load]);

  const refresh = () => { setRefreshing(true); load(); };
  return { rows, loading, refreshing, refresh, reload: load, newCount: rows.filter((r) => !r.mine).length };
}

function QuestionSheet({ row, onClose, onDone }: { row: AskInboxRow; onClose: () => void; onDone: () => void }) {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ask_doctor_attachments").select("*").eq("case_id", row.id);
      const urls: string[] = [];
      for (const a of (data as DbAskDoctorAttachment[]) ?? []) {
        const { data: s } = await supabase.storage.from("ask-doctor-attachments").createSignedUrl(a.storage_path, 3600);
        if (s?.signedUrl) urls.push(s.signedUrl);
      }
      setFiles(urls);
    })();
  }, [row.id]);

  const send = async () => {
    if (text.trim().length < 6) { Alert.alert("", "اكتب ردًا لا يقل عن 6 أحرف"); return; }
    setSending(true);
    const { data, error } = await supabase.rpc("answer_ask_case", { p_case: row.id, p_answer: text.trim() });
    setSending(false);
    if (error) { Alert.alert("خطأ", error.message); return; }
    if (data === "taken") { Alert.alert("", "تم استلام السؤال من طبيب آخر"); onDone(); return; }
    if (data !== "ok") { Alert.alert("", "تعذّر إرسال الرد"); return; }
    onDone();
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: "rgba(0,0,0,.55)", justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: "88%", paddingBottom: insets.bottom + 12 }}>
          <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
              <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 19 }}>{row.mine ? "ردّك" : "الرد على السؤال"}</PText>
              <Pressable onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="close" size={19} color={t.text} />
              </Pressable>
            </View>
            <View style={{ backgroundColor: t.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: row.urgency_flag ? "rgba(229,72,77,.5)" : t.border }}>
              {row.urgency_flag ? (
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <MaterialCommunityIcons name="alert-circle" size={15} color={t.destructive} />
                  <PText style={{ color: t.destructive, fontFamily: TJ.heavy, fontSize: 13 }}>أعراض قد تستدعي الانتباه</PText>
                </View>
              ) : null}
              <PText style={{ color: t.text, fontFamily: TJ.medium, fontSize: 15, lineHeight: 25, textAlign: "right" }}>{row.message}</PText>
              {files.length > 0 ? (
                <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {files.map((u) => <Image key={u} source={{ uri: u }} style={{ width: 72, height: 72, borderRadius: 12 }} contentFit="cover" />)}
                </View>
              ) : row.attachments > 0 ? <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginTop: 8 }}>📎 {row.attachments} مرفقات…</PText> : null}
            </View>

            {row.mine ? (
              <View style={{ backgroundColor: t.goldTint, borderRadius: 18, padding: 14 }}>
                <PText style={{ color: t.text, fontFamily: TJ.medium, fontSize: 15, lineHeight: 25, textAlign: "right" }}>{row.answer}</PText>
              </View>
            ) : (
              <>
                <PText style={{ color: t.text, fontFamily: TJ.bold, fontSize: 14, textAlign: "right" }}>ردك</PText>
                <TextInput
                  value={text} onChangeText={setText} multiline textAlign="right" placeholder="اكتب ردك للمريض…" placeholderTextColor={t.muted}
                  style={{ minHeight: 130, backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.border, padding: 14, color: t.text, fontFamily: TJ.medium, fontSize: 15, textAlignVertical: "top" }}
                />
                <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", lineHeight: 20 }}>
                  لا تستخدم هذه الخدمة للحالات الطارئة. إن بدت الحالة طارئة انصح المريض بالتوجه للطوارئ. أول طبيب يجاوب هو اللي بيستلم السؤال.
                </PText>
                <Pressable onPress={send} disabled={sending}
                  style={({ pressed }) => ({ height: 52, borderRadius: 16, backgroundColor: t.gold, alignItems: "center", justifyContent: "center", opacity: pressed || sending ? 0.85 : 1 })}>
                  {sending ? <ActivityIndicator color={t.onGold} /> : <PText style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 16 }}>اقبل وجاوب</PText>}
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function CasesPanel({ state }: { state: ReturnType<typeof useDoctorCases> }) {
  const t = useMalaz();
  const { rows, loading, reload } = state;
  const [tab, setTab] = useState<"open" | "mine">("open");
  const [selected, setSelected] = useState<AskInboxRow | null>(null);

  if (loading) return <SkeletonCards count={3} padded={false} />;
  const shown = rows.filter((r) => (tab === "open" ? !r.mine : r.mine));
  const openCount = rows.filter((r) => !r.mine).length;

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 4, gap: 10 }}>
      <View style={{ flexDirection: "row-reverse", gap: 8 }}>
        {([["open", "متاحة", openCount], ["mine", "ردودي", 0]] as const).map(([k, name, n]) => {
          const on = tab === k;
          return (
            <Pressable key={k} onPress={() => setTab(k)}
              style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, backgroundColor: on ? t.goldTint : t.card, borderWidth: 1.5, borderColor: on ? t.gold : t.border }}>
              <PText style={{ color: on ? t.goldText : t.text2, fontFamily: TJ.heavy, fontSize: 14 }}>{name}</PText>
              {n > 0 ? <PText style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 13 }}>{n}</PText> : null}
            </Pressable>
          );
        })}
      </View>

      {shown.map((r) => {
        const date = new Date(r.created_at).toLocaleDateString(locale(), { day: "numeric", month: "short" });
        return (
          <Pressable key={r.id} onPress={() => setSelected(r)}
            style={({ pressed }) => ({ backgroundColor: t.card, borderRadius: 22, padding: 14, borderWidth: 1, borderColor: r.urgency_flag ? "rgba(229,72,77,.5)" : t.border, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
            <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
              <PText style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 13 }}>{r.case_number ?? "—"}{r.routed_specialty ? ` · ${r.routed_specialty}` : ""}</PText>
              <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5 }}>{date}</PText>
            </View>
            <PText numberOfLines={2} style={{ color: t.text, fontFamily: TJ.medium, fontSize: 14.5, textAlign: "right", marginTop: 8, lineHeight: 22 }}>{r.message}</PText>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 8 }}>
              {r.urgency_flag ? <MaterialCommunityIcons name="alert-circle" size={15} color={t.destructive} /> : null}
              {r.attachments > 0 ? <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5 }}>📎 {r.attachments}</PText> : null}
              {r.mine ? <PText style={{ color: t.online, fontFamily: TJ.heavy, fontSize: 12.5 }}>✓ تم ردك</PText> : null}
            </View>
          </Pressable>
        );
      })}

      {shown.length === 0 ? (
        <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "center", paddingVertical: 50, lineHeight: 24 }}>
          {tab === "open"
            ? "لا توجد أسئلة متاحة الآن.\nتأكد إن الاستشارة الأونلاين مفعّلة في تعديل الحساب عشان تستلم أسئلة تخصصك."
            : "لسه ماجاوبتش على أي سؤال"}
        </PText>
      ) : null}

      {selected ? <QuestionSheet row={selected} onClose={() => setSelected(null)} onDone={() => { setSelected(null); reload(); }} /> : null}
    </View>
  );
}
