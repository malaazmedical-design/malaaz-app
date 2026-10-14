import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, SafeAreaView, Pressable, ScrollView, Alert, Switch, ActivityIndicator } from "react-native";
import { Text, TextInput } from "@/components/i18n";
import { router, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getProfile, saveProfile } from "@/lib/mizoStorage";
import { startRecording, stopRecordingToUri, cancelRecording } from "@/lib/mizoRecording";
import {
  VoiceProfile, MIN_SAMPLE_SECONDS, getVoiceProfiles, addVoiceProfile,
  cloneVoiceProfile, deleteVoiceProfile,
} from "@/lib/voiceProfiles";

const STATUS_LABEL: Record<VoiceProfile["status"], string> = {
  recorded: "متسجّل — لسه ما اتعملتش البصمة",
  cloning: "جاري إنشاء البصمة...",
  ready: "جاهزة",
  error: "حصلت مشكلة",
};

const READING_TEXT =
  "اتكلم بشكل طبيعي لمدة نص دقيقة على الأقل — احكي عن يومك، أو اقرا أي فقرة بصوت واضح، " +
  "في مكان هادي من غير موسيقى أو أصوات تانية.";

export default function VoiceProfilesScreen() {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [activeId, setActiveId] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setProfiles(await getVoiceProfiles());
    setActiveId((await getProfile()).voiceProfileId);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    cancelRecording();
  }, []);

  const begin = async () => {
    if (!consent) {
      Alert.alert("موافقة مطلوبة", "لازم المريض (أو وليّ أمره) يوافق على استخدام صوته قبل التسجيل.");
      return;
    }
    try {
      await startRecording();
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e: any) {
      Alert.alert(
        "مقدرناش نبدأ التسجيل",
        e?.message === "NEEDS_NATIVE_BUILD"
          ? "الميزة دي محتاجة تحديث نسخة التطبيق."
          : "اتأكد إن إذن الميكروفون مفعّل.",
      );
    }
  };

  const finish = async () => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    setRecording(false);
    if (seconds < MIN_SAMPLE_SECONDS) {
      await cancelRecording();
      Alert.alert("التسجيل قصير", `محتاجين ${MIN_SAMPLE_SECONDS} ثانية على الأقل عشان البصمة تطلع كويسة.`);
      return;
    }
    setBusy(true);
    try {
      const uri = await stopRecordingToUri();
      const profile = await addVoiceProfile(name, uri);
      setName(""); setConsent(false);
      await load();
      await runClone(profile.id);
    } catch (e: any) {
      Alert.alert("خطأ", String(e?.message ?? e));
    } finally {
      setBusy(false);
      load();
    }
  };

  const runClone = async (id: string) => {
    setBusy(true);
    try {
      await cloneVoiceProfile(id);
      await activate(id, false);
    } catch (e: any) {
      Alert.alert("مقدرناش نعمل البصمة", "اتأكد من الإنترنت وجرّب تاني من زر «إعادة المحاولة».");
    } finally {
      setBusy(false);
      load();
    }
  };

  const activate = async (id: string, reload = true) => {
    const p = await getProfile();
    await saveProfile({ ...p, ttsMode: "clone", voiceProfileId: id });
    setActiveId(id);
    if (reload) load();
  };

  const remove = (p: VoiceProfile) => {
    Alert.alert(
      "حذف البصمة",
      `هيتم مسح بصمة «${p.name}» والتسجيل الأصلي وكل الأصوات المحفوظة نهائياً.`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف", style: "destructive",
          onPress: async () => {
            await deleteVoiceProfile(p.id);
            if (p.id === activeId) {
              const cur = await getProfile();
              await saveProfile({ ...cur, ttsMode: "device", voiceProfileId: "" });
              setActiveId("");
            }
            load();
          },
        },
      ],
    );
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-right" size={22} color="#C9A84C" />
        </Pressable>
        <Text style={styles.headerTitle}>بصمة الصوت</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>البصمات المحفوظة</Text>
        {profiles.length === 0 && <Text style={styles.empty}>لسه مفيش بصمات — سجّل أول واحدة تحت.</Text>}
        {profiles.map((p) => (
          <View key={p.id} style={[styles.card, p.id === activeId && styles.cardActive]}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName}>{p.name}</Text>
              {p.id === activeId && <MaterialCommunityIcons name="check-circle" size={20} color="#C9A84C" />}
            </View>
            <Text style={[styles.cardStatus, p.status === "error" && { color: "#CC2200" }]}>
              {STATUS_LABEL[p.status]}
            </Text>
            <View style={styles.cardActions}>
              {p.status === "ready" && p.id !== activeId && (
                <Pressable style={styles.smallBtn} onPress={() => activate(p.id)}>
                  <Text style={styles.smallBtnText}>استخدمها</Text>
                </Pressable>
              )}
              {(p.status === "recorded" || p.status === "error") && (
                <Pressable style={styles.smallBtn} onPress={() => runClone(p.id)} disabled={busy}>
                  <Text style={styles.smallBtnText}>إعادة المحاولة</Text>
                </Pressable>
              )}
              <Pressable style={[styles.smallBtn, styles.smallBtnDanger]} onPress={() => remove(p)}>
                <Text style={[styles.smallBtnText, { color: "#CC2200" }]}>حذف</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <View style={styles.divider} />
        <Text style={styles.label}>بصمة جديدة</Text>
        <Text style={styles.hint}>{READING_TEXT}</Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="اسم صاحب الصوت (مثال: بابا)"
          placeholderTextColor="#9AABAA"
          textAlign="right"
          editable={!recording && !busy}
        />

        <View style={styles.consentRow}>
          <Switch value={consent} onValueChange={setConsent} disabled={recording || busy} />
          <Text style={styles.consentText}>
            صاحب الصوت (أو وليّ أمره) موافق على استخدام صوته لعمل بصمة، وإنها تتبعت للمعالجة وتتحفظ للتطبيق ده بس.
          </Text>
        </View>

        {busy ? (
          <View style={styles.busy}><ActivityIndicator color="#C9A84C" /><Text style={styles.hint}>جاري الإنشاء...</Text></View>
        ) : recording ? (
          <Pressable style={[styles.recBtn, styles.recBtnOn]} onPress={finish}>
            <MaterialCommunityIcons name="stop" size={26} color="#fff" />
            <Text style={styles.recBtnText}>إيقاف وحفظ — {mm}:{ss}</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.recBtn} onPress={begin}>
            <MaterialCommunityIcons name="microphone" size={26} color="#fff" />
            <Text style={styles.recBtnText}>ابدأ التسجيل</Text>
          </Pressable>
        )}
        {recording && seconds < MIN_SAMPLE_SECONDS && (
          <Text style={styles.hint}>كمّل لحد {MIN_SAMPLE_SECONDS} ثانية على الأقل...</Text>
        )}
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
  body: { padding: 20, gap: 10 },
  label: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#1C2B2A", textAlign: "right" },
  hint: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#5B6B6A", textAlign: "right", lineHeight: 22 },
  empty: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#9AABAA", textAlign: "right" },
  divider: { height: 1, backgroundColor: "#DCE4E2", marginVertical: 14 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: "#E3EAE8", gap: 6 },
  cardActive: { borderColor: "#C9A84C" },
  cardTop: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  cardName: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#1C2B2A" },
  cardStatus: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#5B6B6A", textAlign: "right" },
  cardActions: { flexDirection: "row-reverse", gap: 8, marginTop: 4 },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: "#1C2B2A" },
  smallBtnDanger: { backgroundColor: "#FDECEA" },
  smallBtnText: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#C9A84C" },
  input: {
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.5, borderColor: "#E3EAE8",
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: "Cairo_400Regular", fontSize: 15, color: "#1C2B2A",
  },
  consentRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  consentText: { flex: 1, fontFamily: "Cairo_400Regular", fontSize: 13, color: "#1C2B2A", textAlign: "right", lineHeight: 21 },
  recBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#2E7D6B", borderRadius: 14, paddingVertical: 14, marginTop: 6,
  },
  recBtnOn: { backgroundColor: "#CC2200" },
  recBtnText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#fff" },
  busy: { alignItems: "center", gap: 8, paddingVertical: 14 },
});
