import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";

const DARK = "#1C2B2A";
const GOLD = "#C9A84C";
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

function detectRequest(text: string): { intent: string; specialty: string | null; urgency: boolean } {
  const urgency = EMERGENCY_KEYWORDS.some((k) => text.includes(k));
  if (text.includes("تحليل") || text.includes("أشعة") || text.includes("تقرير")) {
    return { intent: "file_review", specialty: null, urgency };
  }
  for (const [key, val] of Object.entries(SPECIALTIES)) {
    if (text.includes(key)) {
      return { intent: "specialty", specialty: val, urgency };
    }
  }
  return { intent: "symptoms", specialty: null, urgency };
}

export default function NewCaseScreen() {
  const insets = useSafeAreaInsets();
  const { client, profile } = useApp();
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isEmergency = EMERGENCY_KEYWORDS.some((k) => message.includes(k));

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("الأذونات", "نحتاج إذن الوصول للصور");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 4));
    }
  };

  const uploadImage = async (uri: string, caseId: string, idx: number): Promise<string | null> => {
    const ext = uri.split(".").pop() ?? "jpg";
    const path = `${caseId}/${idx}.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const { error } = await supabase.storage
      .from("ask-doctor-attachments")
      .upload(path, blob, { contentType: `image/${ext}` });
    if (error) return null;
    return path;
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert("", "اكتب سؤالك أو صف حالتك أولاً");
      return;
    }
    setSubmitting(true);
    try {
      const { intent, specialty, urgency } = detectRequest(message);
      const caseData: Record<string, unknown> = {
        message: message.trim(),
        intent,
        suggested_specialty: specialty,
        urgency_flag: urgency,
        status: "new",
        patient_name: profile?.name ?? null,
        patient_phone: profile?.phone ?? null,
      };
      if (client?.id) caseData.client_id = client.id;

      const { data: created, error } = await supabase
        .from("ask_doctor_cases")
        .insert(caseData)
        .select()
        .single();

      if (error || !created) throw error ?? new Error("فشل إنشاء الحالة");

      // Upload images
      for (let i = 0; i < images.length; i++) {
        const path = await uploadImage(images[i], created.id, i);
        if (path) {
          await supabase.from("ask_doctor_attachments").insert({
            case_id: created.id,
            storage_path: path,
            file_type: "image",
          });
        }
      }

      router.replace(`/ask-doctor/${created.id}`);
    } catch (e: any) {
      Alert.alert("خطأ", e?.message ?? "حدث خطأ، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: DARK }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={{ paddingTop: insets.top + 16, paddingBottom: 16, paddingHorizontal: 20, flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "#FFFFFF15", alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="arrow-right" size={22} color="#FFFFFFCC" />
        </Pressable>
        <Text style={{ color: GOLD, fontFamily: "Cairo_700Bold", fontSize: 20 }}>طلب استشارة جديد</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled">
        {/* Emergency banner */}
        {isEmergency && (
          <View style={{ backgroundColor: "#EF444420", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#EF4444" }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <MaterialCommunityIcons name="alert-circle" size={20} color="#EF4444" />
              <Text style={{ color: "#EF4444", fontFamily: "Cairo_700Bold", fontSize: 14 }}>قد تحتاج هذه الأعراض تقييمًا عاجلاً</Text>
            </View>
            <Text style={{ color: "#FFFFFFCC", fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "right", lineHeight: 22 }}>
              إذا كانت الأعراض شديدة أو تزداد، توجّه لأقرب طوارئ أو اتصل بالإسعاف. لا تنتظر رد الاستشارة داخل التطبيق.
            </Text>
          </View>
        )}

        {/* Message input */}
        <Text style={{ color: "#FFFFFF99", fontFamily: "Cairo_600SemiBold", fontSize: 14, textAlign: "right", marginBottom: 10 }}>
          اكتب سؤالك أو صف حالتك
        </Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="مثال: عندي كحة ووجع في زوري من 3 أيام ومش عارف أكشف تخصص إيه..."
          placeholderTextColor="#FFFFFF44"
          multiline
          textAlign="right"
          style={{
            backgroundColor: "#FFFFFF0D",
            borderRadius: 16,
            padding: 16,
            color: "#FFFFFFEE",
            fontFamily: "Cairo_400Regular",
            fontSize: 15,
            minHeight: 140,
            textAlignVertical: "top",
            borderWidth: 1,
            borderColor: "#FFFFFF15",
          }}
        />

        {/* Attachments */}
        <Text style={{ color: "#FFFFFF99", fontFamily: "Cairo_600SemiBold", fontSize: 14, textAlign: "right", marginTop: 20, marginBottom: 10 }}>
          إرفاق صورة (اختياري)
        </Text>
        <Text style={{ color: "#FFFFFF55", fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right", marginBottom: 12 }}>
          تحليل، أشعة، صورة — حتى 4 مرفقات
        </Text>

        <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 12 }}>
          {images.map((uri, i) => (
            <View key={uri} style={{ position: "relative" }}>
              <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 12 }} />
              <Pressable
                onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                style={{ position: "absolute", top: -6, right: -6, backgroundColor: "#EF4444", borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" }}
              >
                <MaterialCommunityIcons name="close" size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
          {images.length < 4 && (
            <Pressable
              onPress={pickImage}
              style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: "#FFFFFF0D", borderWidth: 1, borderColor: "#FFFFFF22", borderStyle: "dashed", alignItems: "center", justifyContent: "center" }}
            >
              <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF55" />
            </Pressable>
          )}
        </View>

        {/* Hint */}
        <View style={{ backgroundColor: "#C9A84C18", borderRadius: 14, padding: 14, marginTop: 24, borderWidth: 1, borderColor: "#C9A84C33" }}>
          <Text style={{ color: "#C9A84CCC", fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "right", lineHeight: 22 }}>
            💡 كلما وصفت الأعراض بوضوح — المدة، الشدة، والأعراض المصاحبة — كلما كانت الاستشارة أدق وأسرع.
          </Text>
        </View>
      </ScrollView>

      {/* Submit */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: insets.bottom + 20, backgroundColor: DARK }}>
        <Pressable
          onPress={handleSubmit}
          disabled={submitting || !message.trim()}
          style={({ pressed }) => ({
            backgroundColor: submitting || !message.trim() ? "#FFFFFF22" : GOLD,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {submitting ? (
            <ActivityIndicator color={DARK} />
          ) : (
            <Text style={{ color: DARK, fontFamily: "Cairo_700Bold", fontSize: 16 }}>إرسال الطلب</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
