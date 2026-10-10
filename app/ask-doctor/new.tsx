import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { Text, TextInput } from "@/components/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TJ, useMalaz } from "@/constants/malazTheme";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";

const EMERGENCY_KEYWORDS = [
  "صدر", "قلب", "ضيق تنفس", "نزيف شديد", "نزيف", "فقدان الوعي",
  "تشنج", "جلطة", "شلل", "إسعاف", "طوارئ", "انتحار",
];
const SPECIALTIES: Record<string, string> = {
  "باطنة": "باطنة", "جلدية": "جلدية", "عظام": "عظام",
  "أطفال": "أطفال", "نساء": "نساء وتوليد", "قلب": "قلب وأوعية دموية",
  "عيون": "عيون", "أسنان": "أسنان", "نفسية": "نفسية",
  "عصبية": "مخ وأعصاب",
};

// تلميح للأدمن فقط — هو اللي بيحدد التخصص فعليًا
function detectRequest(text: string): { intent: string; specialty: string | null; urgency: boolean } {
  const urgency = EMERGENCY_KEYWORDS.some((k) => text.includes(k));
  if (text.includes("تحليل") || text.includes("أشعة") || text.includes("تقرير")) return { intent: "file_review", specialty: null, urgency };
  for (const [key, val] of Object.entries(SPECIALTIES)) if (text.includes(key)) return { intent: "specialty", specialty: val, urgency };
  return { intent: "symptoms", specialty: null, urgency };
}

export default function NewCaseScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { client, profile } = useApp();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [message, setMessage] = useState("");
  type Att = { uri: string; name: string; pdf: boolean };
  const [images, setImages] = useState<Att[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!edit);
  const webTop = Platform.OS === "web" ? 67 : 0;
  const isEmergency = EMERGENCY_KEYWORDS.some((k) => message.includes(k));

  useEffect(() => {
    if (!edit) return;
    supabase.from("ask_doctor_cases").select("message,status").eq("id", edit).single().then(({ data }) => {
      if (data) {
        if (data.status === "answered") { Alert.alert("", "السؤال اتجاوب خلاص ومينفعش يتعدّل"); router.back(); return; }
        setMessage(data.message);
      }
      setLoadingEdit(false);
    });
  }, [edit]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("الأذونات", "نحتاج إذن الوصول للصور"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.7 });
    if (!result.canceled) setImages((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri, name: a.fileName ?? "image", pdf: false }))].slice(0, 4));
  };

  // PDF needs the native document picker (present in newer builds only)
  const pickPdf = async () => {
    let DocumentPicker: any = null;
    try { DocumentPicker = require("expo-document-picker"); } catch { DocumentPicker = null; }
    if (!DocumentPicker?.getDocumentAsync) { Alert.alert("", "إرفاق PDF يحتاج تحديث التطبيق. تقدر ترفق صور حاليًا."); return; }
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: false });
      if (r.canceled || !r.assets?.[0]) return;
      const a = r.assets[0];
      if ((a.size ?? 0) > 10 * 1024 * 1024) { Alert.alert("", "حجم الملف أكبر من 10 ميجا"); return; }
      setImages((prev) => [...prev, { uri: a.uri, name: a.name ?? "file.pdf", pdf: true }].slice(0, 4));
    } catch { Alert.alert("", "تعذّر اختيار الملف"); }
  };

  const addAttachment = () => Alert.alert("إرفاق", "اختر نوع المرفق", [
    { text: "صورة", onPress: pickImage },
    { text: "ملف PDF", onPress: pickPdf },
    { text: "إلغاء", style: "cancel" },
  ]);

  const uploadImage = async (a: Att, caseId: string, idx: number): Promise<string | null> => {
    try {
      const ext = a.pdf ? "pdf" : (a.uri.split(".").pop() ?? "jpg").toLowerCase().split("?")[0];
      const path = `${caseId}/${Date.now()}_${idx}.${ext}`;
      const buf = await (await fetch(a.uri)).arrayBuffer();
      const { error } = await supabase.storage.from("ask-doctor-attachments").upload(path, buf, { contentType: a.pdf ? "application/pdf" : `image/${ext === "jpg" ? "jpeg" : ext}` });
      return error ? null : path;
    } catch { return null; }
  };

  const attach = async (caseId: string) => {
    let failed = 0;
    for (let i = 0; i < images.length; i++) {
      const path = await uploadImage(images[i], caseId, i);
      if (!path) { failed++; continue; }
      await supabase.from("ask_doctor_attachments").insert({ case_id: caseId, storage_path: path, file_type: images[i].pdf ? "pdf" : "image" });
    }
    return failed;
  };

  const handleSubmit = async () => {
    const text = message.trim();
    if (text.length < 3) { Alert.alert("", "اكتب سؤالك أو صف حالتك أولاً"); return; }
    if (!client?.id) { router.push("/client-auth"); return; }
    setSubmitting(true);
    try {
      let caseId = edit;
      if (edit) {
        const { data, error } = await supabase.rpc("edit_ask_case", { p_case: edit, p_message: text });
        if (error) throw error;
        if (data === "locked") { Alert.alert("", "السؤال اتجاوب خلاص ومينفعش يتعدّل"); router.back(); return; }
      } else {
        const { intent, specialty, urgency } = detectRequest(text);
        const { data: created, error } = await supabase
          .from("ask_doctor_cases")
          .insert({
            message: text, intent, suggested_specialty: specialty, urgency_flag: urgency, status: "new",
            client_id: client.id, patient_name: profile?.name ?? null, patient_phone: profile?.phone ?? null,
          })
          .select("id")
          .single();
        if (error || !created) throw error ?? new Error("فشل إرسال السؤال");
        caseId = created.id;
      }
      const failed = caseId ? await attach(caseId) : 0;
      if (failed) Alert.alert("", "السؤال اتبعت، لكن بعض المرفقات ماترفعتش");
      router.replace(`/ask-doctor/${caseId}`);
    } catch (e: any) {
      Alert.alert("خطأ", e?.message ?? "حدث خطأ، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = submitting || message.trim().length < 3;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: insets.top + 12 + webTop, paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="رجوع" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="arrow-right" size={22} color={t.text} />
        </Pressable>
        <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 22 }}>{edit ? "تعديل سؤالك" : "سؤال جديد"}</Text>
      </View>

      {loadingEdit ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={t.gold} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled">
          {edit ? (
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: t.goldTint, borderRadius: 14, padding: 12, marginBottom: 14 }}>
              <MaterialCommunityIcons name="pencil-outline" size={18} color={t.goldText} />
              <Text style={{ flex: 1, color: t.text2, fontFamily: TJ.bold, fontSize: 13.5, textAlign: "right" }}>بتعدّل سؤالك</Text>
              <Pressable onPress={() => router.back()}><Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 13.5 }}>إلغاء التعديل</Text></Pressable>
            </View>
          ) : null}
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: t.goldTint, borderRadius: 14, padding: 12, marginBottom: 14 }}>
            <MaterialCommunityIcons name="gift-outline" size={20} color={t.goldText} />
            <Text style={{ flex: 1, color: t.text2, fontFamily: TJ.bold, fontSize: 13.5, textAlign: "right", lineHeight: 21 }}>
              السؤال مجاني للعميل. هيوصل لطبيب مختص وأول طبيب متاح هيرد عليك.
            </Text>
          </View>

          {isEmergency && (
            <View style={{ backgroundColor: "rgba(229,72,77,.12)", borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: t.destructive }}>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <MaterialCommunityIcons name="alert-circle" size={20} color={t.destructive} />
                <Text style={{ color: t.destructive, fontFamily: TJ.heavy, fontSize: 14 }}>قد تحتاج هذه الأعراض تقييمًا عاجلاً</Text>
              </View>
              <Text style={{ color: t.text2, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "right", lineHeight: 22 }}>
                لو الأعراض شديدة أو بتزيد، توجّه لأقرب طوارئ أو اتصل بالإسعاف 123. ماتنتظرش الرد.
              </Text>
            </View>
          )}

          <Text style={{ color: t.text, fontFamily: TJ.bold, fontSize: 14, textAlign: "right", marginBottom: 8 }}>اكتب سؤالك أو وصف حالتك</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="مثال: عندي كحة ووجع في زوري من 3 أيام..."
            placeholderTextColor={t.muted}
            multiline
            textAlign="right"
            style={{ backgroundColor: t.card, borderRadius: 18, padding: 16, color: t.text, fontFamily: TJ.medium, fontSize: 15, minHeight: 150, textAlignVertical: "top", borderWidth: 1, borderColor: t.border }}
          />

          <Text style={{ color: t.text, fontFamily: TJ.bold, fontSize: 14, textAlign: "right", marginTop: 20, marginBottom: 4 }}>
            مرفقات <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12 }}>(اختياري)</Text>
          </Text>
          <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginBottom: 10 }}>تحليل، أشعة، صورة أو PDF — حتى 4 ملفات (PDF حتى 10 ميجا)</Text>
          <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 12 }}>
            {images.map((a, i) => (
              <View key={a.uri}>
                {a.pdf ? (
                  <View style={{ width: 80, height: 80, borderRadius: 14, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, alignItems: "center", justifyContent: "center", padding: 4 }}>
                    <MaterialCommunityIcons name="file-pdf-box" size={30} color={t.destructive} />
                    <Text numberOfLines={1} style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 10 }}>{a.name}</Text>
                  </View>
                ) : <Image source={{ uri: a.uri }} style={{ width: 80, height: 80, borderRadius: 14 }} />}
                <Pressable onPress={() => setImages((p) => p.filter((_, k) => k !== i))} style={{ position: "absolute", top: -6, right: -6, backgroundColor: t.destructive, borderRadius: 10, width: 22, height: 22, alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name="close" size={13} color="#fff" />
                </Pressable>
              </View>
            ))}
            {images.length < 4 && (
              <Pressable onPress={addAttachment} style={{ width: 80, height: 80, borderRadius: 14, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="paperclip" size={26} color={t.muted} />
              </Pressable>
            )}
          </View>

          <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginTop: 22, lineHeight: 21 }}>
            💡 كل ما وصفت المدة والشدة والأعراض المصاحبة بوضوح، كان الرد أدق. الخدمة دي مش للحالات الطارئة.
          </Text>
        </ScrollView>
      )}

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: insets.bottom + 16, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.border }}>
        <Pressable onPress={handleSubmit} disabled={disabled} style={({ pressed }) => ({ height: 54, borderRadius: 18, backgroundColor: disabled ? t.btn : t.gold, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.88 : 1 })}>
          {submitting ? <ActivityIndicator color={t.onGold} /> : <Text style={{ color: disabled ? t.muted : t.onGold, fontFamily: TJ.heavy, fontSize: 16 }}>{edit ? "حفظ التعديل" : "إرسال السؤال"}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
