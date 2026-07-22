import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, Pressable, ScrollView, Animated,
} from "react-native";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getProfile, getVoiceOptions, logEvent, sendFamilyNotification } from "@/lib/mizoStorage";

type BodyPart = { id: string; label: string; emoji: string; phrase: string };
type Severity = { id: string; label: string; emoji: string; color: string; modifier: string };

const BODY_PARTS: BodyPart[] = [
  { id: "head",    label: "الراس",       emoji: "🤕", phrase: "راسي بيوجعني" },
  { id: "eye",     label: "العين",       emoji: "👁️", phrase: "عيني بتوجعني" },
  { id: "ear",     label: "الودن",       emoji: "👂", phrase: "ودني بتوجعني" },
  { id: "throat",  label: "الزور",       emoji: "🗣️", phrase: "زوري بيوجعني" },
  { id: "chest",   label: "الصدر",       emoji: "💔", phrase: "صدري بيوجعني" },
  { id: "belly",   label: "البطن",       emoji: "🫃", phrase: "بطني بتوجعني" },
  { id: "back",    label: "الضهر",       emoji: "🔙", phrase: "ضهري بيوجعني" },
  { id: "arm",     label: "الدراع",      emoji: "💪", phrase: "دراعي بيوجعني" },
  { id: "hand",    label: "الإيد",       emoji: "✋", phrase: "إيدي بتوجعني" },
  { id: "leg",     label: "الرجل",       emoji: "🦵", phrase: "رجلي بتوجعني" },
  { id: "knee",    label: "الركبة",      emoji: "🦿", phrase: "ركبتي بتوجعني" },
  { id: "foot",    label: "القدم",       emoji: "🦶", phrase: "قدمي بتوجعني" },
];

const SEVERITIES: Severity[] = [
  { id: "mild",   label: "خفيف",  emoji: "🟡", color: "#D4A017", modifier: "شوية" },
  { id: "medium", label: "متوسط", emoji: "🟠", color: "#E07B00", modifier: "متوسط" },
  { id: "severe", label: "شديد",  emoji: "🔴", color: "#CC2200", modifier: "شديد جداً" },
];

export default function MizoPainScreen() {
  const [selectedPart, setSelectedPart] = useState<BodyPart | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<Severity>(SEVERITIES[1]);
  const [voiceOpts, setVoiceOpts] = useState(getVoiceOptions("male"));
  const [profile, setProfile] = useState<{ patientName: string; quietHoursEnabled: boolean; quietHoursStart: number; quietHoursEnd: number } | null>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const mizoScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    getProfile().then((p) => {
      setVoiceOpts(getVoiceOptions(p.voiceType));
      setProfile({
        patientName: p.patientName,
        quietHoursEnabled: p.quietHoursEnabled,
        quietHoursStart: p.quietHoursStart,
        quietHoursEnd: p.quietHoursEnd,
      });
    });
  }, []);

  const flashScreen = (color: string) => {
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.spring(mizoScale, { toValue: 1.12, useNativeDriver: true, speed: 30 }),
      Animated.spring(mizoScale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
  };

  const handleSpeak = useCallback(() => {
    if (!selectedPart) return;
    const phrase = `${selectedPart.phrase} — الوجع ${selectedSeverity.modifier}`;
    Speech.stop();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    flashScreen(selectedSeverity.color);
    Speech.speak(phrase, voiceOpts);
    logEvent({ word_id: `pain_${selectedPart.id}`, phrase, category: "pain", is_emergency: selectedSeverity.id === "severe" });
    if (profile) {
      sendFamilyNotification(
        profile.patientName, phrase,
        selectedSeverity.id === "severe",
        profile.quietHoursEnabled, profile.quietHoursStart, profile.quietHoursEnd,
      );
    }
  }, [selectedPart, selectedSeverity, voiceOpts, profile]);

  const flashColor = selectedSeverity.id === "severe" ? "#CC2200" : selectedSeverity.id === "medium" ? "#E07B00" : "#D4A017";

  return (
    <SafeAreaView style={styles.safe}>
      {/* Flash overlay */}
      <Animated.View
        pointerEvents="none"
        style={[styles.flashOverlay, { opacity: flashAnim, backgroundColor: flashColor }]}
      />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-right" size={26} color="#C9A84C" />
        </Pressable>
        <Text style={styles.headerTitle}>أنا وجعني</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Severity selector */}
        <Text style={styles.sectionTitle}>مستوى الوجع</Text>
        <View style={styles.severityRow}>
          {SEVERITIES.map((s) => (
            <Pressable
              key={s.id}
              style={[styles.severityBtn, selectedSeverity.id === s.id && { borderColor: s.color, backgroundColor: `${s.color}22` }]}
              onPress={() => setSelectedSeverity(s)}
            >
              <Text style={styles.severityEmoji}>{s.emoji}</Text>
              <Text style={[styles.severityLabel, selectedSeverity.id === s.id && { color: s.color }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Body parts grid */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>فين بالظبط؟</Text>
        <View style={styles.grid}>
          {BODY_PARTS.map((part) => (
            <Pressable
              key={part.id}
              style={[
                styles.partCard,
                selectedPart?.id === part.id && styles.partCardActive,
                selectedPart?.id === part.id && { borderColor: flashColor },
              ]}
              onPress={() => setSelectedPart(part)}
            >
              <Text style={styles.partEmoji}>{part.emoji}</Text>
              <Text style={[styles.partLabel, selectedPart?.id === part.id && { color: flashColor }]}>{part.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Preview phrase */}
        {selectedPart && (
          <View style={styles.phrasePreview}>
            <Text style={styles.phraseText}>
              {`${selectedPart.phrase} — الوجع ${selectedSeverity.modifier}`}
            </Text>
          </View>
        )}

        {/* Speak button */}
        <Animated.View style={{ transform: [{ scale: mizoScale }] }}>
          <Pressable
            style={[styles.speakBtn, { backgroundColor: flashColor }, !selectedPart && styles.speakBtnDisabled]}
            onPress={handleSpeak}
            disabled={!selectedPart}
          >
            <MaterialCommunityIcons name="volume-high" size={24} color="#fff" />
            <Text style={styles.speakBtnText}>قول وبعّت للأهل</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7F6" },
  flashOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99, pointerEvents: "none",
  },
  header: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#1C2B2A",
  },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#C9A84C" },
  backBtn: { padding: 4 },
  body: { padding: 16 },

  sectionTitle: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#1C2B2A", textAlign: "right", marginBottom: 10 },

  severityRow: { flexDirection: "row", gap: 8 },
  severityBtn: {
    flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 14,
    backgroundColor: "#fff", borderWidth: 2, borderColor: "#E0E8E7",
  },
  severityEmoji: { fontSize: 24, marginBottom: 4 },
  severityLabel: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#1C2B2A" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" },
  partCard: {
    width: "22%", aspectRatio: 1, backgroundColor: "#fff", borderRadius: 14,
    alignItems: "center", justifyContent: "center", gap: 4,
    borderWidth: 2, borderColor: "#E0E8E7",
  },
  partCardActive: { backgroundColor: "#FDFAF3" },
  partEmoji: { fontSize: 28 },
  partLabel: { fontFamily: "Cairo_700Bold", fontSize: 12, color: "#1C2B2A", textAlign: "center" },

  phrasePreview: {
    backgroundColor: "#1C2B2A", borderRadius: 14, padding: 14, marginTop: 16, marginBottom: 8,
  },
  phraseText: { fontFamily: "Cairo_600SemiBold", fontSize: 15, color: "#FFFFFF", textAlign: "right" },

  speakBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 18, borderRadius: 16, marginTop: 8, marginBottom: 12,
  },
  speakBtnDisabled: { opacity: 0.4 },
  speakBtnText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#fff" },
});
