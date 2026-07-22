import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  SafeAreaView, Dimensions, Animated, Platform, BackHandler,
  Modal, TextInput, Alert,
} from "react-native";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MIZO_CATEGORIES, MizoWord } from "@/constants/mizoWords";
import { MIZO_IMAGES } from "@/constants/mizoImages";
import {
  getProfile, getVoiceOptions, logEvent,
  getCustomWords, CustomWord,
} from "@/lib/mizoStorage";

const { width } = Dimensions.get("window");
const isTablet = width >= 768;
const CARD_SIZE = (width - 48) / (isTablet ? 5 : 3);
type MizoState = "neutral" | "speaking" | "success" | "alert" | "thinking";

export default function MizoLockedScreen() {
  const [activeCat, setActiveCat] = useState(MIZO_CATEGORIES[0].id);
  const [lastPhrase, setLastPhrase] = useState("اضغط على أي كلمة...");
  const [mizoState, setMizoState] = useState<MizoState>("neutral");
  const [subWords, setSubWords] = useState<MizoWord[] | null>(null);
  const [voiceOpts, setVoiceOpts] = useState(getVoiceOptions("male"));
  const [customWords, setCustomWords] = useState<CustomWord[]>([]);
  const [patientName, setPatientName] = useState("المريض");
  const [pinModal, setPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [correctPin, setCorrectPin] = useState("1234");
  const [titleTaps, setTitleTaps] = useState(0);
  const titleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mizoScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      const profile = await getProfile();
      setPatientName(profile.patientName || "المريض");
      setVoiceOpts(getVoiceOptions(profile.voiceType));
      setCorrectPin(profile.patientPin || "1234");
      setCustomWords(await getCustomWords());
    })();
  }, []);

  // منع زر الرجوع في أندرويد
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => handler.remove();
  }, []);

  const bounceMizo = () => {
    Animated.sequence([
      Animated.spring(mizoScale, { toValue: 1.12, useNativeDriver: true, speed: 30 }),
      Animated.spring(mizoScale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
  };

  const speak = useCallback((phrase: string, wordId = "", category = "", isEmergency = false) => {
    Speech.stop();
    setLastPhrase(phrase);
    setMizoState("speaking");
    bounceMizo();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Speech.speak(phrase, {
      ...voiceOpts,
      onDone: () => setMizoState("neutral"),
      onError: () => setMizoState("neutral"),
    });
    logEvent({ word_id: wordId, phrase, category, is_emergency: isEmergency });
  }, [voiceOpts]);

  const handleWordPress = (word: MizoWord) => {
    if (word.children && word.children.length > 0) {
      setSubWords(word.children);
      setMizoState("thinking");
    } else {
      setSubWords(null);
      speak(word.phrase, word.id, activeCat);
    }
  };

  const handleEmergency = () => {
    setMizoState("alert");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    speak("النجدة! أنا محتاج مساعدة فوراً!", "emergency", "emergency", true);
  };

  // ثلاث ضغطات على العنوان تفتح مربع الـ PIN
  const handleTitleTap = () => {
    const next = titleTaps + 1;
    setTitleTaps(next);
    if (titleTapTimer.current) clearTimeout(titleTapTimer.current);
    if (next >= 3) {
      setTitleTaps(0);
      setPinInput("");
      setPinModal(true);
      return;
    }
    titleTapTimer.current = setTimeout(() => setTitleTaps(0), 1500);
  };

  const handlePinSubmit = () => {
    if (pinInput === correctPin) {
      setPinModal(false);
      router.push("/mizo/settings");
    } else {
      Alert.alert("رقم سري غلط", "حاول تاني");
      setPinInput("");
    }
  };

  const currentCategory = MIZO_CATEGORIES.find((c) => c.id === activeCat);
  const activeCatCustomWords = customWords
    .filter((w) => w.category_id === activeCat)
    .map((w): MizoWord => ({ id: w.id, label: w.label, emoji: w.emoji, phrase: w.phrase }));
  const displayWords = subWords ?? [...(currentCategory?.words ?? []), ...activeCatCustomWords];

  const mizoImage = MIZO_IMAGES[
    mizoState === "speaking" ? "speaking"
    : mizoState === "success" ? "success"
    : mizoState === "alert"   ? "alert"
    : mizoState === "thinking"? "thinking"
    : "neutral"
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header — بدون أي أزرار تنقل */}
      <View style={styles.header}>
        <Pressable onPress={handleTitleTap} style={styles.exitHint}>
          <MaterialCommunityIcons name="lock" size={13} color="#C9A84C44" />
        </Pressable>
        <Pressable onPress={handleTitleTap}>
          <Text style={styles.headerTitle}>ميزو</Text>
        </Pressable>
        <View style={{ width: 34 }} />
      </View>

      {/* Mizo mascot + last phrase */}
      <View style={styles.mizoRow}>
        <Animated.View style={{ transform: [{ scale: mizoScale }] }}>
          <Image source={mizoImage} style={styles.mizoImg} resizeMode="contain" />
        </Animated.View>
        <View style={styles.phraseBox}>
          <Pressable
            onPress={() => lastPhrase !== "اضغط على أي كلمة..." && speak(lastPhrase)}
            style={styles.phraseInner}
          >
            <MaterialCommunityIcons name="volume-high" size={20} color="#C9A84C" />
            <Text style={styles.phraseText} numberOfLines={2}>{lastPhrase}</Text>
          </Pressable>
          <Text style={styles.patientName}>{patientName}</Text>
        </View>
      </View>

      {/* Yes / No */}
      <View style={styles.yesNoRow}>
        <Pressable style={[styles.yesNoBtn, styles.noBtn]} onPress={() => speak("لأ", "no_quick", "responses")}>
          <Text style={styles.yesNoText}>❌  لأ</Text>
        </Pressable>
        <Pressable
          style={[styles.yesNoBtn, styles.yesBtn]}
          onPress={() => { setMizoState("success"); speak("ايوه", "yes_quick", "responses"); setTimeout(() => setMizoState("neutral"), 1500); }}
        >
          <Text style={styles.yesNoText}>✅  ايوه</Text>
        </Pressable>
      </View>

      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catBar}>
        {subWords && (
          <Pressable style={[styles.catTab, styles.catTabBack]} onPress={() => setSubWords(null)}>
            <Text style={styles.catTabText}>↩ رجوع</Text>
          </Pressable>
        )}
        {[...MIZO_CATEGORIES].reverse().map((cat) => {
          const isActive = activeCat === cat.id && !subWords;
          return (
            <Pressable
              key={cat.id}
              style={[styles.catTab, isActive && styles.catTabActive]}
              onPress={() => { setActiveCat(cat.id); setSubWords(null); }}
            >
              <Text style={[styles.catTabText, isActive && styles.catTabTextActive]}>
                {cat.emoji}{"  "}{cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Words grid */}
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {displayWords.map((word) => (
          <Pressable
            key={word.id}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => handleWordPress(word)}
          >
            <Text style={styles.cardEmoji}>{word.emoji}</Text>
            <Text style={styles.cardLabel}>{word.label}</Text>
            {word.children && word.children.length > 0 && (
              <Text style={styles.cardArrow}>›</Text>
            )}
          </Pressable>
        ))}
      </ScrollView>

      {/* Emergency */}
      <Pressable style={styles.emergencyBtn} onPress={handleEmergency}>
        <MaterialCommunityIcons name="alert-circle" size={22} color="#fff" />
        <Text style={styles.emergencyText}>🆘  النجدة</Text>
      </Pressable>

      {/* PIN Modal */}
      <Modal visible={pinModal} transparent animationType="fade">
        <Pressable style={styles.pinOverlay} onPress={() => setPinModal(false)}>
          <Pressable style={styles.pinBox} onPress={(e) => e.stopPropagation()}>
            <MaterialCommunityIcons name="lock-outline" size={32} color="#1C2B2A" />
            <Text style={styles.pinTitle}>أدخل رقم الأهل السري</Text>
            <TextInput
              style={styles.pinInput}
              value={pinInput}
              onChangeText={setPinInput}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              textAlign="center"
              autoFocus
              placeholder="••••"
              placeholderTextColor="#9AABAA"
            />
            <Pressable style={styles.pinBtn} onPress={handlePinSubmit}>
              <Text style={styles.pinBtnText}>دخول</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#C9A84C" },
  exitHint: { width: 34, alignItems: "center", justifyContent: "center" },
  mizoRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#1C2B2A",
    gap: 12,
  },
  mizoImg: { width: 80, height: 80 },
  phraseBox: { flex: 1, backgroundColor: "#253D3B", borderRadius: 14, padding: 2 },
  phraseInner: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 10 },
  phraseText: { fontFamily: "Cairo_600SemiBold", fontSize: 16, color: "#FFFFFF", textAlign: "right", flex: 1 },
  patientName: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#C9A84C88", textAlign: "right", paddingHorizontal: 10, paddingBottom: 6 },
  yesNoRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  yesNoBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  yesBtn: { backgroundColor: "#1C6B3A" },
  noBtn: { backgroundColor: "#8B1A1A" },
  yesNoText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#FFFFFF" },
  catBar: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  catTab: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22,
    backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#C9D6D4",
  },
  catTabActive: { backgroundColor: "#1C2B2A", borderColor: "#1C2B2A" },
  catTabBack: { backgroundColor: "#C9A84C22", borderWidth: 2, borderColor: "#C9A84C" },
  catTabText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#1C2B2A" },
  catTabTextActive: { color: "#C9A84C" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, paddingBottom: 12, gap: 8, justifyContent: "flex-end" },
  card: {
    width: CARD_SIZE, height: CARD_SIZE, backgroundColor: "#FFFFFF", borderRadius: 16,
    alignItems: "center", justifyContent: "center", gap: 4,
    borderWidth: 1.5, borderColor: "#E0E8E7",
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  cardPressed: { backgroundColor: "#EDF5F4", transform: [{ scale: 0.95 }] },
  cardEmoji: { fontSize: 34 },
  cardLabel: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#1C2B2A", textAlign: "center" },
  cardArrow: { position: "absolute", top: 6, left: 8, fontSize: 18, color: "#C9A84C", fontWeight: "700" },
  emergencyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#CC2200", marginHorizontal: 12,
    marginBottom: Platform.OS === "ios" ? 8 : 12,
    paddingVertical: 16, borderRadius: 16,
  },
  emergencyText: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#FFFFFF" },
  pinOverlay: { flex: 1, backgroundColor: "#00000088", alignItems: "center", justifyContent: "center" },
  pinBox: {
    backgroundColor: "#fff", borderRadius: 24, padding: 28, width: 280,
    alignItems: "center", gap: 16,
  },
  pinTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#1C2B2A", textAlign: "center" },
  pinInput: {
    width: "100%", backgroundColor: "#F5F7F6", borderRadius: 12,
    paddingVertical: 14, fontSize: 24, letterSpacing: 8,
    fontFamily: "Cairo_700Bold", color: "#1C2B2A",
    borderWidth: 1.5, borderColor: "#E0E8E7",
  },
  pinBtn: { backgroundColor: "#1C2B2A", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  pinBtnText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#C9A84C" },
});
