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
  MizoProfile, VoiceType, TtsMode, AzureVoice,
} from "@/lib/mizoStorage";
import { clearAzureCache } from "@/lib/azureTts";

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

const DWELL_OPTIONS = [
  { value: 0,    label: "متفعّل", desc: "يشتغل فور الضغطة" },
  { value: 500,  label: "٠.٥ ث", desc: "استنى نص ثانية" },
  { value: 1000, label: "١ ث",   desc: "استنى ثانية" },
  { value: 1500, label: "١.٥ ث", desc: "استنى ثانية ونص" },
];

const TTS_MODES: { id: TtsMode; emoji: string; label: string; desc: string }[] = [
  {
    id: "device",
    emoji: "📱",
    label: "صوت الجهاز",
    desc: "يستخدم محرك الكلام المثبت على الجهاز — مجاني وبيشتغل offline",
  },
  {
    id: "azure",
    emoji: "🌐",
    label: "صوت Azure",
    desc: "أصوات مصرية Neural عالية الجودة — محتاج إنترنت ومفتاح Azure",
  },
  {
    id: "recorded",
    emoji: "🎙️",
    label: "صوت المريض",
    desc: "سجّل صوت المريض على كل بطاقة — يشتغل offline بصوته الحقيقي",
  },
];

const AZURE_VOICES: { id: AzureVoice; label: string; desc: string }[] = [
  { id: "ar-EG-SalmaNeural",  label: "سلمى",  desc: "صوت ست مصري طبيعي" },
  { id: "ar-EG-ShakirNeural", label: "شاكر",  desc: "صوت راجل مصري طبيعي" },
];

const USER_TYPES: { id: string; emoji: string; label: string; desc: string }[] = [
  {
    id: "stroke",
    emoji: "🧠",
    label: "سكتة دماغية",
    desc: "حبسة كلامية أو صعوبة في النطق بعد السكتة",
  },
  {
    id: "tbi",
    emoji: "🤕",
    label: "إصابة دماغية رضية",
    desc: "صعوبة في التواصل بعد حادثة أو رضة دماغية",
  },
  {
    id: "als",
    emoji: "💪",
    label: "التصلب الجانبي (ALS)",
    desc: "تراجع تدريجي في القدرة على الكلام",
  },
  {
    id: "quadriplegia",
    emoji: "♿",
    label: "شلل رباعي / حركي",
    desc: "يستخدم الشاشة أو وسيلة إدخال مساعدة",
  },
  {
    id: "laryngeal",
    emoji: "🔇",
    label: "فقدان الصوت",
    desc: "سرطان الحنجرة أو فقدان الصوت بعد جراحة",
  },
  {
    id: "elderly",
    emoji: "👴",
    label: "كبار السن",
    desc: "ضعف في النطق أو الحركة أو الإدراك",
  },
  {
    id: "alzheimer",
    emoji: "🌀",
    label: "الزهايمر / الخرف",
    desc: "المراحل المبكرة — لتحسين التواصل مع الأسرة",
  },
  {
    id: "parkinson",
    emoji: "🫳",
    label: "الشلل الرعاش",
    desc: "ضعف الصوت أو بطء الكلام",
  },
  {
    id: "child_aac",
    emoji: "🧒",
    label: "طفل — تواصل",
    desc: "توحد أو تأخر اللغة، بواجهة مخصصة",
  },
  {
    id: "",
    emoji: "👤",
    label: "عام",
    desc: "حالة أخرى أو غير محددة",
  },
];

export default function MizoSettingsScreen() {
  const [profile, setProfile] = useState<MizoProfile>({
    patientName: "", voiceType: "male", patientMode: false, patientPin: "1234",
    dwellTime: 0, quietHoursEnabled: false, quietHoursStart: 22, quietHoursEnd: 7,
    oneHandedMode: false, userType: "",
    ttsMode: "device", azureVoice: "ar-EG-SalmaNeural", azureKey: "", azureRegion: "eastus",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await saveProfile(profile);
    setSaving(false);
    // If patient mode was disabled, replace the whole mizo stack so we land on the normal screen
    if (!profile.patientMode) {
      router.replace("/mizo");
    } else {
      router.back();
    }
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

  const handleClearAzureCache = () => {
    Alert.alert("مسح كاش Azure", "هيتمسح الصوت المحفوظ وهيتنزل من Azure تاني. متأكد؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "امسح", style: "destructive",
        onPress: async () => { await clearAzureCache(); Alert.alert("تم", "الكاش اتمسح"); },
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

        {/* ── نوع المستخدم / الحالة الصحية ── */}
        <Text style={styles.label}>الحالة الصحية للمريض</Text>
        <Text style={styles.modeDesc}>اختار الحالة الأقرب — بتساعدنا نظبط ميزو عشانه</Text>
        <View style={styles.conditionGrid}>
          {USER_TYPES.map((u) => {
            const active = profile.userType === u.id;
            return (
              <Pressable
                key={u.id}
                style={[
                  styles.conditionCard,
                  u.id === "" && styles.conditionCardFull,
                  active && styles.conditionCardActive,
                ]}
                onPress={() => setProfile((p) => ({ ...p, userType: u.id }))}
              >
                <Text style={styles.conditionEmoji}>{u.emoji}</Text>
                <Text style={[styles.conditionLabel, active && styles.conditionLabelActive]}>
                  {u.label}
                </Text>
                <Text style={styles.conditionDesc}>{u.desc}</Text>
                {active && (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={16}
                    color="#C9A84C"
                    style={styles.conditionCheck}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ── اسم المريض ── */}
        <Text style={[styles.label, { marginTop: 20 }]}>اسم المريض</Text>
        <TextInput
          style={styles.input}
          value={profile.patientName}
          onChangeText={(v) => setProfile((p) => ({ ...p, patientName: v }))}
          placeholder="مثال: محمد"
          placeholderTextColor="#9AABAA"
          textAlign="right"
        />

        {/* ── اختيار الصوت ── */}
        <Text style={[styles.label, { marginTop: 20 }]}>نوع الصوت</Text>
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

        {/* ── محرك الكلام ── */}
        <View style={styles.sectionDivider} />
        <Text style={styles.label}>محرك الكلام</Text>
        <Text style={styles.modeDesc}>اختار الطريقة اللي ميزو يتكلم بيها</Text>
        <View style={styles.conditionGrid}>
          {TTS_MODES.map((m) => {
            const active = profile.ttsMode === m.id;
            return (
              <Pressable
                key={m.id}
                style={[styles.conditionCard, styles.conditionCardFull, active && styles.conditionCardActive]}
                onPress={() => setProfile((p) => ({ ...p, ttsMode: m.id }))}
              >
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, flex: 1 }}>
                  <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.conditionLabel, active && styles.conditionLabelActive]}>{m.label}</Text>
                    <Text style={styles.conditionDesc}>{m.desc}</Text>
                  </View>
                  {active && <MaterialCommunityIcons name="check-circle" size={20} color="#C9A84C" />}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ── إعدادات Azure ── */}
        {profile.ttsMode === "azure" && (
          <>
            <Text style={[styles.label, { marginTop: 16 }]}>الصوت المصري</Text>
            <View style={styles.dwellRow}>
              {AZURE_VOICES.map((v) => (
                <Pressable
                  key={v.id}
                  style={[styles.dwellBtn, profile.azureVoice === v.id && styles.dwellBtnActive]}
                  onPress={() => setProfile((p) => ({ ...p, azureVoice: v.id }))}
                >
                  <Text style={[styles.dwellLabel, profile.azureVoice === v.id && styles.dwellLabelActive]}>
                    {v.label}
                  </Text>
                  <Text style={styles.dwellDesc}>{v.desc}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 14 }]}>مفتاح Azure (Subscription Key)</Text>
            <TextInput
              style={styles.input}
              value={profile.azureKey}
              onChangeText={(v) => setProfile((p) => ({ ...p, azureKey: v.trim() }))}
              placeholder="الصق مفتاح Azure هنا"
              placeholderTextColor="#9AABAA"
              textAlign="right"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />

            <Text style={[styles.label, { marginTop: 14 }]}>المنطقة (Region)</Text>
            <TextInput
              style={styles.input}
              value={profile.azureRegion}
              onChangeText={(v) => setProfile((p) => ({ ...p, azureRegion: v.trim().toLowerCase() }))}
              placeholder="مثال: eastus أو uaenorth"
              placeholderTextColor="#9AABAA"
              textAlign="right"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Pressable style={styles.secondaryBtn} onPress={handleClearAzureCache}>
              <MaterialCommunityIcons name="cached" size={16} color="#1C2B2A" />
              <Text style={styles.secondaryBtnText}>مسح كاش Azure</Text>
            </Pressable>
          </>
        )}

        {/* ── تعليمات صوت المريض ── */}
        {profile.ttsMode === "recorded" && (
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>🎙️ كيف تسجّل صوت المريض؟</Text>
            <Text style={styles.infoBoxText}>
              ١. اضغط وأمسك (Long Press) على أي بطاقة في ميزو{"\n"}
              ٢. اختار «سجّل صوت المريض»{"\n"}
              ٣. اضغط على زر التسجيل والمريض يقول الكلمة{"\n"}
              ٤. اضغط إيقاف ثم احفظ{"\n\n"}
              لو البطاقة مالهاش تسجيل، ميزو هيستخدم صوت الجهاز تلقائياً.
            </Text>
          </View>
        )}

        {/* ── وقت الإمساك (dwell) ── */}
        <View style={styles.sectionDivider} />
        <Text style={styles.label}>وقت الإمساك (منع الضغط الغلط)</Text>
        <Text style={styles.modeDesc}>
          لو فعّلته، الكلمة بتتقال بس لو ضغطت وأمسكت الزرار للوقت المحدد.
          مفيد لو المريض بيلمس الشاشة بالغلط.
        </Text>
        <View style={styles.dwellRow}>
          {DWELL_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.dwellBtn, profile.dwellTime === opt.value && styles.dwellBtnActive]}
              onPress={() => setProfile((p) => ({ ...p, dwellTime: opt.value }))}
            >
              <Text style={[styles.dwellLabel, profile.dwellTime === opt.value && styles.dwellLabelActive]}>
                {opt.label}
              </Text>
              <Text style={styles.dwellDesc}>{opt.desc}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── وضع اليد الواحدة ── */}
        <View style={styles.sectionDivider} />
        <Text style={styles.label}>وضع اليد الواحدة</Text>
        <Text style={styles.modeDesc}>يكبّر البطاقات ويقللها لعمودين بدل تلاتة.</Text>
        <View style={styles.switchRow}>
          <Switch
            value={profile.oneHandedMode}
            onValueChange={(v) => setProfile((p) => ({ ...p, oneHandedMode: v }))}
            trackColor={{ false: "#E0E8E7", true: "#1C2B2A" }}
            thumbColor={profile.oneHandedMode ? "#C9A84C" : "#7A8A89"}
          />
          <Text style={styles.switchLabel}>
            {profile.oneHandedMode ? "وضع اليد الواحدة مفعّل" : "وضع اليد الواحدة متفعّلش"}
          </Text>
        </View>

        {/* ── ساعات الهدوء ── */}
        <View style={styles.sectionDivider} />
        <Text style={styles.label}>ساعات الهدوء</Text>
        <Text style={styles.modeDesc}>
          في الساعات دي، الإشعارات العادية للأهل بتتوقف. الطوارئ بتوصل دايماً.
        </Text>
        <View style={styles.switchRow}>
          <Switch
            value={profile.quietHoursEnabled}
            onValueChange={(v) => setProfile((p) => ({ ...p, quietHoursEnabled: v }))}
            trackColor={{ false: "#E0E8E7", true: "#1C2B2A" }}
            thumbColor={profile.quietHoursEnabled ? "#C9A84C" : "#7A8A89"}
          />
          <Text style={styles.switchLabel}>
            {profile.quietHoursEnabled ? "ساعات الهدوء مفعّلة" : "ساعات الهدوء متفعّلاش"}
          </Text>
        </View>
        {profile.quietHoursEnabled && (
          <View style={styles.quietRow}>
            <View style={styles.quietField}>
              <Text style={styles.quietFieldLabel}>بتبدأ الساعة</Text>
              <TextInput
                style={styles.quietInput}
                value={String(profile.quietHoursStart)}
                onChangeText={(v) => setProfile((p) => ({ ...p, quietHoursStart: Math.min(23, Math.max(0, parseInt(v) || 0)) }))}
                keyboardType="numeric" maxLength={2} textAlign="center"
              />
              <Text style={styles.quietFieldLabel}>مساءً</Text>
            </View>
            <View style={styles.quietField}>
              <Text style={styles.quietFieldLabel}>بتخلص الساعة</Text>
              <TextInput
                style={styles.quietInput}
                value={String(profile.quietHoursEnd)}
                onChangeText={(v) => setProfile((p) => ({ ...p, quietHoursEnd: Math.min(23, Math.max(0, parseInt(v) || 0)) }))}
                keyboardType="numeric" maxLength={2} textAlign="center"
              />
              <Text style={styles.quietFieldLabel}>صباحاً</Text>
            </View>
          </View>
        )}

        {/* ── وضع المريض ── */}
        <View style={styles.sectionDivider} />
        <Text style={styles.label}>وضع المريض</Text>
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

        {/* ── حفظ ── */}
        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? "جاري الحفظ..." : "حفظ الإعدادات"}</Text>
        </Pressable>

        {/* ── مسح السجل ── */}
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
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#1C2B2A",
  },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#C9A84C" },
  backBtn: { padding: 4 },
  body: { padding: 20 },

  label: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#1C2B2A", textAlign: "right", marginBottom: 8 },
  input: {
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontFamily: "Cairo_600SemiBold", fontSize: 16, color: "#1C2B2A",
    borderWidth: 1.5, borderColor: "#E0E8E7",
  },

  conditionGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4,
  },
  conditionCard: {
    width: "47.5%", backgroundColor: "#fff", borderRadius: 14,
    padding: 12, borderWidth: 1.5, borderColor: "#E0E8E7",
    alignItems: "flex-end",
  },
  conditionCardFull: { width: "100%" },
  conditionCardActive: { borderColor: "#C9A84C", backgroundColor: "#FDFAF3" },
  conditionEmoji: { fontSize: 26, marginBottom: 6, alignSelf: "flex-end" },
  conditionLabel: {
    fontFamily: "Cairo_700Bold", fontSize: 13, color: "#1C2B2A",
    textAlign: "right", marginBottom: 3,
  },
  conditionLabelActive: { color: "#C9A84C" },
  conditionDesc: {
    fontFamily: "Cairo_400Regular", fontSize: 11, color: "#7A8A89",
    textAlign: "right", lineHeight: 16,
  },
  conditionCheck: { position: "absolute", top: 8, left: 8 },

  voiceHint: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#7A8A89", textAlign: "right", marginBottom: 8 },
  voiceGroupTitle: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#1C2B2A", textAlign: "right", marginTop: 14, marginBottom: 6 },
  voiceCard: {
    flexDirection: "row-reverse", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1.5, borderColor: "#E0E8E7",
  },
  voiceCardActive: { borderColor: "#C9A84C", backgroundColor: "#FDFAF3" },
  voiceLabel: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#1C2B2A", textAlign: "right" },
  voiceLabelActive: { color: "#C9A84C" },
  voiceDesc: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#7A8A89", textAlign: "right" },
  tryBtn: { backgroundColor: "#E8EDEC", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tryBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#1C2B2A" },

  sectionDivider: { height: 1, backgroundColor: "#E0E8E7", marginVertical: 20 },
  modeDesc: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#7A8A89", textAlign: "right", marginBottom: 12, lineHeight: 20 },
  switchRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 8 },
  switchLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#1C2B2A" },

  dwellRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dwellBtn: {
    flex: 1, minWidth: "45%", alignItems: "center", paddingVertical: 12, borderRadius: 12,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E0E8E7",
  },
  dwellBtnActive: { borderColor: "#C9A84C", backgroundColor: "#FDFAF3" },
  dwellLabel: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#1C2B2A" },
  dwellLabelActive: { color: "#C9A84C" },
  dwellDesc: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#7A8A89", marginTop: 2 },

  quietRow: { flexDirection: "row", gap: 16, marginTop: 8 },
  quietField: { flex: 1, alignItems: "center", gap: 4 },
  quietFieldLabel: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#7A8A89" },
  quietInput: {
    backgroundColor: "#fff", borderRadius: 10, width: 64, paddingVertical: 8,
    fontFamily: "Cairo_700Bold", fontSize: 20, color: "#1C2B2A",
    borderWidth: 1.5, borderColor: "#E0E8E7", textAlign: "center",
  },

  saveBtn: {
    backgroundColor: "#1C2B2A", borderRadius: 14, paddingVertical: 16,
    alignItems: "center", marginTop: 24, marginBottom: 12,
  },
  saveBtnText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#C9A84C" },
  dangerBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 14,
  },
  dangerText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#CC2200" },

  secondaryBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, marginTop: 10,
    backgroundColor: "#E8EDEC", borderRadius: 10,
  },
  secondaryBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#1C2B2A" },

  infoBox: {
    backgroundColor: "#EEF6F4", borderRadius: 14, padding: 16, marginTop: 12,
    borderWidth: 1, borderColor: "#C9E0DC",
  },
  infoBoxTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 14, color: "#1C2B2A",
    textAlign: "right", marginBottom: 8,
  },
  infoBoxText: {
    fontFamily: "Cairo_400Regular", fontSize: 13, color: "#3A5A55",
    textAlign: "right", lineHeight: 22,
  },
});
