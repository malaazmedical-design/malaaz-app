import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, SafeAreaView,
  Pressable, ScrollView, Alert, Switch,
} from "react-native";
import * as Speech from "expo-speech";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  getProfile, saveProfile, clearLocalEvents, getVoiceOptions,
  MizoProfile, VoiceType,
} from "@/lib/mizoStorage";

type VoiceOption = { key: VoiceType; label: string; emoji: string; desc: string };

const VOICE_GROUPS: { title: string; emoji: string; options: VoiceOption[] }[] = [
  {
    title: "راجل", emoji: "👨",
    options: [
      { key: "male_1", label: "راجل ١", emoji: "👨", desc: "صوت عميق وهادي" },
      { key: "male_2", label: "راجل ٢", emoji: "👨", desc: "صوت طبيعي متوسط" },
      { key: "male_3", label: "راجل ٣", emoji: "👨", desc: "صوت خفيف وسريع" },
    ],
  },
  {
    title: "ست", emoji: "👩",
    options: [
      { key: "female_1", label: "ست ١", emoji: "👩", desc: "صوت هادي ومريح" },
      { key: "female_2", label: "ست ٢", emoji: "👩", desc: "صوت طبيعي متوسط" },
      { key: "female_3", label: "ست ٣", emoji: "👩", desc: "صوت مرتفع وحيوي" },
    ],
  },
  {
    title: "طفل", emoji: "👦",
    options: [
      { key: "child_1", label: "طفل ١", emoji: "👦", desc: "صوت هادي ومريح" },
      { key: "child_2", label: "طفل ٢", emoji: "👦", desc: "صوت طبيعي متوسط" },
      { key: "child_3", label: "طفل ٣", emoji: "👦", desc: "صوت حيوي ومبهج" },
    ],
  },
];

export default function MizoSettingsScreen() {
  const [profile, setProfile] = useState<MizoProfile>({ patientName: "", voiceType: "male", patientMode: false, patientPin: "1234" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await saveProfile(profile);
    setSaving(false);
    router.back();
  };

  const handleClearHistory = () => {
    Alert.alert("مسح السجل", "هتمسح كل سجل الكلام — مش هيرجع. متأكد؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "امسح", style: "destructive",
        onPress: async () => { await clearLocalEvents(); Alert.alert("تم", "السجل اتمسح"); },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-right" size={26} color="#C9A84C" />
        </Pressable>
        <Text style={styles.headerTitle}>إعدادات ميزو</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* اسم المريض */}
        <Text style={styles.label}>اسم المريض</Text>
        <TextInput
          style={styles.input}
          value={profile.patientName}
          onChangeText={(v) => setProfile((p) => ({ ...p, patientName: v }))}
          placeholder="مثال: محمد"
          placeholderTextColor="#9AABAA"
          textAlign="right"
        />

        {/* اختيار الصوت */}
        <Text style={[styles.label, { marginTop: 24 }]}>نوع الصوت</Text>
        <Text style={styles.voiceHint}>اضغط على "جرّب" عشان تسمع كل صوت قبل ما تختار</Text>
        {VOICE_GROUPS.map((group) => (
          <View key={group.title}>
            <Text style={styles.voiceGroupTitle}>{group.emoji} صوت {group.title}</Text>
            {group.options.map((opt) => (
              <Pressable
                key={opt.key}
                style={[styles.voiceCard, profile.voiceType === opt.key && styles.voiceCardActive]}
                onPress={() => setProfile((p) => ({ ...p, voiceType: opt.key }))}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.voiceLabel, profile.voiceType === opt.key && styles.voiceLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.voiceDesc}>{opt.desc}</Text>
                </View>
                <Pressable
                  style={styles.tryBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    Speech.stop();
                    const { language, rate, pitch } = getVoiceOptions(opt.key);
                    Speech.speak("أنا عايز مية", { language, rate, pitch });
                  }}
                >
                  <Text style={styles.tryBtnText}>جرّب</Text>
                </Pressable>
                {profile.voiceType === opt.key && (
                  <MaterialCommunityIcons name="check-circle" size={22} color="#C9A84C" />
                )}
              </Pressable>
            ))}
          </View>
        ))}

        {/* وضع المريض */}
        <View style={styles.sectionDivider} />
        <Text style={[styles.label, { marginTop: 4 }]}>وضع المريض</Text>
        <Text style={styles.modeDesc}>
          لما تفعّله، التطبيق بيفتح على ميزو فقط وبيقفل باقي الشاشات.
          الأهل يضغطوا على "ميزو" ٣ مرات ويدخلوا الرقم السري عشان يخرجوا.
        </Text>
        <View style={styles.switchRow}>
          <Switch
            value={profile.patientMode}
            onValueChange={(v) => setProfile((p) => ({ ...p, patientMode: v }))}
            trackColor={{ false: "#E0E8E7", true: "#1C2B2A" }}
            thumbColor={profile.patientMode ? "#C9A84C" : "#7A8A89"}
          />
          <Text style={styles.switchLabel}>
            {profile.patientMode ? "وضع المريض مفعّل" : "وضع المريض متفعّلش"}
          </Text>
        </View>

        {profile.patientMode && (
          <>
            <Text style={[styles.label, { marginTop: 12 }]}>الرقم السري للأهل (4-6 أرقام)</Text>
            <TextInput
              style={styles.input}
              value={profile.patientPin}
              onChangeText={(v) => setProfile((p) => ({ ...p, patientPin: v.replace(/[^0-9]/g, "") }))}
              keyboardType="numeric"
              maxLength={6}
              secureTextEntry
              placeholder="مثال: 1234"
              placeholderTextColor="#9AABAA"
              textAlign="right"
            />
          </>
        )}

        {/* زرار الحفظ */}
        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? "جاري الحفظ..." : "حفظ الإعدادات"}</Text>
        </Pressable>

        {/* مسح السجل */}
        <Pressable style={styles.dangerBtn} onPress={handleClearHistory}>
          <MaterialCommunityIcons name="delete-outline" size={18} color="#CC2200" />
          <Text style={styles.dangerText}>مسح سجل الكلام</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7F6" },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1C2B2A",
  },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#C9A84C" },
  backBtn: { padding: 4 },
  body: { padding: 20 },

  label: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#1C2B2A", textAlign: "right", marginBottom: 8 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 16,
    color: "#1C2B2A",
    borderWidth: 1.5,
    borderColor: "#E0E8E7",
  },

  voiceHint: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#7A8A89", textAlign: "right", marginBottom: 8 },
  voiceGroupTitle: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#1C2B2A", textAlign: "right", marginTop: 14, marginBottom: 6 },
  voiceCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "#E0E8E7",
  },
  voiceCardActive: { borderColor: "#C9A84C", backgroundColor: "#FDFAF3" },
  voiceLabel: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#1C2B2A", textAlign: "right" },
  voiceLabelActive: { color: "#C9A84C" },
  voiceDesc: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#7A8A89", textAlign: "right" },
  tryBtn: { backgroundColor: "#E8EDEC", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tryBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#1C2B2A" },

  saveBtn: {
    backgroundColor: "#1C2B2A",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  saveBtnText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#C9A84C" },

  dangerBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
  },
  dangerText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#CC2200" },
  sectionDivider: { height: 1, backgroundColor: "#E0E8E7", marginVertical: 20 },
  modeDesc: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#7A8A89", textAlign: "right", marginBottom: 12, lineHeight: 20 },
  switchRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 8 },
  switchLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#1C2B2A" },
});
