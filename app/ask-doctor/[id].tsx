import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProviderAvatar } from "@/components/ProviderAvatar";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { askStatus } from "@/lib/askStatus";
import { supabase, AskCaseDoctor, DbAskDoctorAttachment, DbAskDoctorCase } from "@/lib/supabase";


function Step({ done, label, sub, last, color, t }: { done: boolean; label: string; sub?: string; last?: boolean; color: string; t: ReturnType<typeof useMalaz> }) {
  return (
    <View style={{ flexDirection: "row-reverse", gap: 12 }}>
      <View style={{ alignItems: "center" }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: done ? color : t.btn, alignItems: "center", justifyContent: "center" }}>
          {done ? <MaterialCommunityIcons name="check" size={15} color="#fff" /> : null}
        </View>
        {!last ? <View style={{ width: 2, height: 26, backgroundColor: done ? color : t.border }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 10 }}>
        <Text style={{ color: done ? t.text : t.muted, fontFamily: TJ.heavy, fontSize: 14.5, textAlign: "right" }}>{label}</Text>
        {sub ? <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginTop: 1 }}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export default function CaseDetailScreen() {
  const t = useMalaz();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 67 : 0;
  const [c, setC] = useState<DbAskDoctorCase | null>(null);
  const [doc, setDoc] = useState<AskCaseDoctor | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("ask_doctor_cases").select("*").eq("id", id).single();
    const row = (data as DbAskDoctorCase) ?? null;
    setC(row);
    if (row?.status === "answered") {
      const { data: d } = await supabase.rpc("ask_case_doctor", { p_case: id });
      setDoc(((d as AskCaseDoctor[]) ?? [])[0] ?? null);
    }
    const { data: atts } = await supabase.from("ask_doctor_attachments").select("*").eq("case_id", id).order("created_at");
    const urls: string[] = [];
    for (const a of (atts as DbAskDoctorAttachment[]) ?? []) {
      const { data: s } = await supabase.storage.from("ask-doctor-attachments").createSignedUrl(a.storage_path, 3600);
      if (s?.signedUrl) urls.push(s.signedUrl);
    }
    setFiles(urls);
    setLoading(false);
    setRefreshing(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`ask_case_${id}_${Date.now()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ask_doctor_cases", filter: `id=eq.${id}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={t.gold} /></View>;
  }
  if (!c) {
    return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}><Text style={{ color: t.muted, fontFamily: TJ.medium }}>السؤال غير موجود</Text></View>;
  }

  const st = askStatus(c.status);
  const answered = c.status === "answered";
  const editable = c.status === "new" || c.status === "routed";
  const fmt = (d: string) => new Date(d).toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const docName = doc ? (doc.name.startsWith("د") ? doc.name : `د. ${doc.name}`) : "";

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top + 12 + webTop, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="رجوع" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="arrow-right" size={22} color={t.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 20, textAlign: "right" }}>سؤالك</Text>
          <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right" }}>{c.case_number}</Text>
        </View>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 5, backgroundColor: st.color + "26", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}>
          <MaterialCommunityIcons name={st.icon} size={14} color={st.color} />
          <Text style={{ color: st.color, fontFamily: TJ.bold, fontSize: 12.5 }}>{st.label}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={t.gold} />}
      >
        {/* السؤال */}
        <View style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 20, padding: 16 }}>
          <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: t.muted, fontFamily: TJ.bold, fontSize: 12.5 }}>سؤالك</Text>
            {editable ? (
              <Pressable onPress={() => router.push({ pathname: "/ask-doctor/new", params: { edit: c.id } })} accessibilityLabel="تعديل السؤال" hitSlop={10}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.ic, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="pencil-outline" size={17} color={t.goldText} />
              </Pressable>
            ) : null}
          </View>
          <Text style={{ color: t.text, fontFamily: TJ.medium, fontSize: 15, lineHeight: 25, textAlign: "right", marginTop: 6 }}>{c.message}</Text>
          {c.edited_at ? <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 11.5, textAlign: "right", marginTop: 6 }}>اتعدّل {fmt(c.edited_at)}</Text> : null}
          {files.length > 0 ? (
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {files.map((u) => <Image key={u} source={{ uri: u }} style={{ width: 64, height: 64, borderRadius: 12 }} contentFit="cover" />)}
            </View>
          ) : null}
        </View>

        {/* الحالة */}
        <View style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 20, padding: 16 }}>
          <Step t={t} color="#1fa65a" done label="تم الإرسال" sub={fmt(c.created_at)} />
          <Step t={t} color="#1fa65a" done={answered} last label="تم الرد" sub={answered && c.answered_at ? fmt(c.answered_at) : "بانتظار رد طبيب مختص — هيجيلك إشعار"} />
        </View>

        {/* الرد */}
        {answered && c.answer ? (
          <View style={{ backgroundColor: t.card, borderWidth: 1.5, borderColor: t.gold, borderRadius: 20, padding: 16 }}>
            {doc ? (
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <ProviderAvatar provider={{ name: doc.name, avatar: doc.photo_url ? { uri: doc.photo_url } : undefined } as any} style={{ width: 46, height: 46, borderRadius: 23 }} letterSize={20} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15.5, textAlign: "right" }}>{docName}</Text>
                  <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right" }}>{[doc.grade, doc.specialty].filter(Boolean).join(" · ")}</Text>
                </View>
              </View>
            ) : null}
            <Text style={{ color: t.text, fontFamily: TJ.medium, fontSize: 15, lineHeight: 26, textAlign: "right" }}>{c.answer}</Text>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 12, backgroundColor: t.goldTint, borderRadius: 12, padding: 10 }}>
              <MaterialCommunityIcons name="gift-outline" size={16} color={t.goldText} />
              <Text style={{ flex: 1, color: t.text2, fontFamily: TJ.bold, fontSize: 12.5, textAlign: "right" }}>هذا الرد مجاني بالكامل لك</Text>
            </View>
            <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 11.5, textAlign: "right", marginTop: 10, lineHeight: 19 }}>
              الرد للتوجيه العام ولا يغني عن الفحص الطبي. في الحالات الطارئة اتصل بالإسعاف 123.
            </Text>
          </View>
        ) : null}

        {/* عرض الحجز بعد الرد */}
        {answered && doc ? (
          <View style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 20, padding: 16, gap: 10 }}>
            <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 16, textAlign: "right" }}>احجز مع {docName} الآن</Text>
            <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13, textAlign: "right" }}>كمّل مع نفس الطبيب اللي رد عليك</Text>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, backgroundColor: t.ic, opacity: 0.75 }}>
              <MaterialCommunityIcons name="message-video" size={22} color={t.goldText} />
              <Text style={{ flex: 1, color: t.text, fontFamily: TJ.heavy, fontSize: 14.5, textAlign: "right" }}>استشارة أونلاين</Text>
              <Text style={{ color: t.muted, fontFamily: TJ.bold, fontSize: 12.5 }}>{doc.online_price != null ? `من ${doc.online_price} ج.م · ` : ""}قريبًا</Text>
            </View>
            <Pressable
              onPress={() => router.push(`/provider/${doc.provider_id}`)}
              style={({ pressed }) => ({ flexDirection: "row-reverse", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, backgroundColor: t.goldTint, borderWidth: 1.5, borderColor: t.gold, transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <MaterialCommunityIcons name="stethoscope" size={22} color={t.goldText} />
              <Text style={{ flex: 1, color: t.text, fontFamily: TJ.heavy, fontSize: 14.5, textAlign: "right" }}>كشف منزلي</Text>
              {doc.visit_price != null ? <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 14.5 }}>{doc.visit_price} ج.م</Text> : null}
              <MaterialCommunityIcons name="chevron-left" size={20} color={t.muted} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
