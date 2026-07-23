import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  SafeAreaView, Dimensions, Animated, Platform, BackHandler,
  Modal, TextInput, Alert, Vibration,
} from "react-native";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MIZO_CATEGORIES, MizoWord } from "@/constants/mizoWords";
import { MIZO_IMAGES } from "@/constants/mizoImages";
import {
  getProfile, getVoiceOptions, logEvent,
  getCustomWords, CustomWord, notifyPrimaryContact,
  getSmartSuggestions, getTopWords, getQuickPins, SmartSuggestion,
} from "@/lib/mizoStorage";

const { width } = Dimensions.get("window");
const isTablet = width >= 768;
const CARD_SIZE = (width - 48) / (isTablet ? 5 : 3);
type MizoState = "neutral" | "speaking" | "success" | "alert" | "thinking";

export default function MizoLockedScreen() {
  const isNight = (() => { const h = new Date().getHours(); return h >= 22 || h < 7; })();
  const [activeCat, setActiveCat] = useState(() => {
    const h = new Date().getHours();
    return (h >= 22 || h < 7) ? "comfort" : MIZO_CATEGORIES[0].id;
  });
  const [lastPhrase, setLastPhrase] = useState("اضغط على أي كلمة...");
  const [mizoState, setMizoState] = useState<MizoState>("neutral");
  const [subWords, setSubWords] = useState<MizoWord[] | null>(null);
  const [voiceOpts, setVoiceOpts] = useState(getVoiceOptions("male"));
  const [customWords, setCustomWords] = useState<CustomWord[]>([]);
  const [smartWords, setSmartWords] = useState<SmartSuggestion[]>([]);
  const [pinnedWords, setPinnedWords] = useState<SmartSuggestion[]>([]);
  const [quickPinIds, setQuickPinIds] = useState<string[]>(["water", "bathroom", "medicine", "pain"]);
  const [patientName, setPatientName] = useState("المريض");
  const [pinModal, setPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [correctPin, setCorrectPin] = useState("1234");
  const [titleTaps, setTitleTaps] = useState(0);
  const titleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mizoScale = useRef(new Animated.Value(1)).current;

  // Soft buzzer
  const [buzzerSent, setBuzzerSent] = useState(false);
  const buzzerCooldown = useRef(false);
  const buzzerScale = useRef(new Animated.Value(1)).current;
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState(22);
  const [quietEnd, setQuietEnd] = useState(7);

  useEffect(() => {
    (async () => {
      const profile = await getProfile();
      setPatientName(profile.patientName || "المريض");
      setVoiceOpts(getVoiceOptions(profile.voiceType));
      setCorrectPin(profile.patientPin || "1234");
      setQuietEnabled(profile.quietHoursEnabled);
      setQuietStart(profile.quietHoursStart);
      setQuietEnd(profile.quietHoursEnd);
      setCustomWords(await getCustomWords());
      setSmartWords(await getSmartSuggestions(new Date().getHours()));
      setPinnedWords(await getTopWords(6));
      setQuickPinIds(await getQuickPins());
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

  const handleBuzzer = () => {
    if (buzzerCooldown.current) return;
    buzzerCooldown.current = true;
    setBuzzerSent(true);

    Vibration.vibrate([0, 500, 150, 500, 150, 500]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Speech.stop();
    Speech.speak("لو سمحتم! في حد هنا؟ محتاج مساعدة", { ...voiceOpts });

    Animated.sequence([
      Animated.spring(buzzerScale, { toValue: 1.06, useNativeDriver: true, speed: 25 }),
      Animated.spring(buzzerScale, { toValue: 1, useNativeDriver: true, speed: 18 }),
    ]).start();

    const phrase = `${patientName} بينادي عليك — روح شوفه`;
    notifyPrimaryContact(patientName, phrase, quietEnabled, quietStart, quietEnd);
    logEvent({ word_id: "buzzer", phrase, category: "buzzer", is_emergency: false });

    setTimeout(() => { setBuzzerSent(false); buzzerCooldown.current = false; }, 5000);
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

  const findWord = (id: string, words?: MizoWord[]): MizoWord | null => {
    const list = words ?? MIZO_CATEGORIES.flatMap((c) => c.words);
    for (const w of list) {
      if (w.id === id) return w;
      if (w.children?.length) { const f = findWord(id, w.children); if (f) return f; }
    }
    return null;
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
    <SafeAreaView style={[styles.safe, isNight && { backgroundColor: "#0D1A19" }]}>
      {/* Header — بدون أي أزرار تنقل */}
      <View style={[styles.header, isNight && { backgroundColor: "#071210" }]}>
        <Pressable onPress={handleTitleTap} style={styles.exitHint}>
          <MaterialCommunityIcons name="lock" size={13} color="#C9A84C44" />
        </Pressable>
        <Pressable onPress={handleTitleTap}>
          <Text style={[styles.headerTitle, isNight && { color: "#B89038" }]}>
            {isNight ? "ميزو 🌙" : "ميزو"}
          </Text>
        </Pressable>
        <View style={{ width: 34 }} />
      </View>

      {/* Mizo mascot + last phrase */}
      <View style={[styles.mizoRow, isNight && { backgroundColor: "#0A1614" }]}>
        <Animated.View style={{ transform: [{ scale: mizoScale }] }}>
          <Image source={mizoImage} style={styles.mizoImg} resizeMode="contain" />
        </Animated.View>
        <View style={[styles.phraseBox, isNight && { backgroundColor: "#0A1614" }]}>
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
      <View style={[styles.yesNoRow, isNight && { backgroundColor: "#0D1A19" }]}>
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

      {/* Quick Access Bar — dynamic pins (managed by caregiver) */}
      <View style={[styles.quickBar, isNight && { backgroundColor: "#0A1412", borderBottomColor: "#1A2E2C" }]}>
        {quickPinIds.map((pinId) => {
          const w = findWord(pinId);
          if (!w) return null;
          return (
            <Pressable
              key={pinId}
              style={({ pressed }) => [styles.quickBtn, pressed && styles.quickBtnPressed]}
              onPress={() => speak(w.phrase, w.id, "quick")}
            >
              <Text style={styles.quickEmoji}>{w.emoji}</Text>
              <Text style={styles.quickLabel} numberOfLines={1}>{w.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Soft Buzzer */}
      <View style={[styles.buzzerWrap, isNight && { backgroundColor: "#0D1A19" }]}>
        <Animated.View style={{ transform: [{ scale: buzzerScale }], flex: 1, alignSelf: "stretch" }}>
          <Pressable
            style={[styles.buzzerBtn, buzzerSent && styles.buzzerBtnSent]}
            onPress={handleBuzzer}
            disabled={buzzerCooldown.current}
          >
            <MaterialCommunityIcons
              name={buzzerSent ? "bell-ring" : "bell-outline"}
              size={22}
              color={buzzerSent ? "#FFFFFF" : "#C9A84C"}
            />
            <Text style={[styles.buzzerText, buzzerSent && styles.buzzerTextSent]}>
              {buzzerSent ? "✓  تم إرسال النداء" : "نادوا حد يجيلي"}
            </Text>
          </Pressable>
        </Animated.View>
      </View>


      {/* Category tabs */}
      <View style={[styles.catBarWrap, isNight && { backgroundColor: "#0D1A19" }]}>
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
              style={[
                styles.catTab,
                isActive && styles.catTabActive,
                isNight && !isActive && { backgroundColor: "#1A2E2E", borderColor: "#2A4040" },
                isNight && isActive && { backgroundColor: "#C9A84C", borderColor: "#C9A84C" },
              ]}
              onPress={() => { setActiveCat(cat.id); setSubWords(null); }}
            >
              <Text style={styles.catTabEmoji}>{cat.emoji}</Text>
              <Text style={[
                styles.catTabText,
                isActive && styles.catTabTextActive,
                isNight && !isActive && { color: "#8ABAB7" },
                isNight && isActive && { color: "#0D1A19" },
              ]}>{cat.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      </View>


      {/* Words grid */}
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}
        style={isNight ? { flex: 1, backgroundColor: "#0D1A19" } : { flex: 1 }}>
        {/* Auto-pinned: top words by all-time usage */}
        {pinnedWords.length >= 2 && !subWords && (
          <View style={styles.pinnedBlock}>
            <View style={styles.pinnedHeader}>
              <MaterialCommunityIcons name="pin" size={13} color="#C9A84C" />
              <Text style={styles.pinnedTitle}>الأكثر استخداماً</Text>
            </View>
            <View style={styles.pinnedRow}>
              {pinnedWords.map((sw) => {
                const word = findWord(sw.word_id);
                return (
                  <Pressable
                    key={`pin_${sw.word_id}`}
                    style={({ pressed }) => [styles.card, styles.cardPinned, { width: CARD_SIZE, height: CARD_SIZE }, pressed && styles.cardPressed]}
                    onPress={() => speak(sw.phrase, sw.word_id, "pinned")}
                  >
                    <Text style={styles.cardEmoji}>{word?.emoji ?? "💬"}</Text>
                    <Text style={styles.cardLabel} numberOfLines={2}>{word?.label ?? sw.phrase.slice(0, 12)}</Text>
                    <View style={styles.pinBadge}>
                      <MaterialCommunityIcons name="pin" size={9} color="#C9A84C" />
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.pinnedSep} />
          </View>
        )}

        {displayWords.map((word) => {
          const isPinned = quickPinIds.includes(word.id);
          return (
            <Pressable
              key={word.id}
              style={({ pressed }) => [styles.card, { width: CARD_SIZE, height: CARD_SIZE }, pressed && styles.cardPressed, isPinned && styles.cardQuickPinned]}
              onPress={() => handleWordPress(word)}
            >
              <Text style={styles.cardEmoji}>{word.emoji}</Text>
              <Text style={styles.cardLabel} numberOfLines={2}>{word.label}</Text>
              {word.children && word.children.length > 0 && (
                <Text style={styles.cardArrow}>›</Text>
              )}
              {isPinned && (
                <View style={styles.quickPinBadge}>
                  <MaterialCommunityIcons name="pin" size={9} color="#C9A84C" />
                </View>
              )}
            </Pressable>
          );
        })}
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
  yesNoRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 4 },
  yesNoBtn: { flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  yesBtn: { backgroundColor: "#1C6B3A" },
  noBtn: { backgroundColor: "#8B1A1A" },
  yesNoText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#FFFFFF" },
  buzzerWrap: { paddingHorizontal: 12, paddingVertical: 2, flexDirection: "row" },
  buzzerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#FFFDF5", borderRadius: 14, paddingVertical: 9,
    borderWidth: 2, borderColor: "#C9A84C",
    elevation: 2, shadowColor: "#C9A84C", shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  buzzerBtnSent: { backgroundColor: "#1C6B3A", borderColor: "#1C6B3A" },
  buzzerText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#7A4A00" },
  buzzerTextSent: { color: "#FFFFFF" },

  quickBar: {
    flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 3,
    backgroundColor: "#EEF3F2", borderBottomWidth: 1, borderBottomColor: "#D8E3E2",
  },
  quickBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    backgroundColor: "#FFFFFF", borderRadius: 12, paddingVertical: 5,
    borderWidth: 1.5, borderColor: "#D8E3E2",
    elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  quickBtnPressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  quickEmoji: { fontSize: 17 },
  quickLabel: { fontFamily: "Cairo_700Bold", fontSize: 12, color: "#1C2B2A" },

  smartBar: {
    backgroundColor: "#EEF3FF", borderBottomWidth: 1, borderBottomColor: "#D0DAF5",
    paddingTop: 4, paddingBottom: 3,
  },
  smartBarTitle: {
    fontFamily: "Cairo_600SemiBold", fontSize: 11, color: "#4A6BA8",
    textAlign: "right", paddingHorizontal: 14, marginBottom: 3,
  },
  smartBarScroll: { paddingHorizontal: 12, gap: 8, alignItems: "center" },
  smartChip: {
    alignItems: "center", justifyContent: "center", gap: 3,
    backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 4, paddingHorizontal: 11,
    borderWidth: 1.5, borderColor: "#C0D0F0",
    elevation: 1, shadowColor: "#4A6BA8", shadowOpacity: 0.10, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    minWidth: 62,
  },
  smartChipPressed: { opacity: 0.75, transform: [{ scale: 0.94 }] },
  smartChipEmoji: { fontSize: 26 },
  smartChipLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: "#1C2B2A", textAlign: "center" },

  catBarWrap: { height: 38 },
  catBar: { paddingHorizontal: 12, paddingVertical: 2, gap: 6 },
  catTabEmoji: { fontSize: 13 },
  catTab: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 14,
    backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#C9D6D4",
  },
  catTabActive: { backgroundColor: "#1C2B2A", borderColor: "#1C2B2A" },
  catTabBack: { backgroundColor: "#C9A84C22", borderWidth: 1.5, borderColor: "#C9A84C" },
  catTabText: { fontFamily: "Cairo_700Bold", fontSize: 12, color: "#1C2B2A" },
  catTabTextActive: { color: "#C9A84C" },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", paddingHorizontal: 12, paddingTop: 2, paddingBottom: 12, gap: 8, justifyContent: "flex-start" },
  card: {
    width: CARD_SIZE, height: CARD_SIZE, backgroundColor: "#FFFFFF", borderRadius: 16,
    alignItems: "center", justifyContent: "center", gap: 4,
    borderWidth: 1.5, borderColor: "#E0E8E7",
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  cardPressed: { backgroundColor: "#EDF5F4", transform: [{ scale: 0.95 }] },
  cardPinned: { borderColor: "#C9A84C55", backgroundColor: "#FDFAF3" },
  cardQuickPinned: { borderColor: "#C9A84C88", backgroundColor: "#FFFDF0" },
  quickPinBadge: { position: "absolute", top: 4, left: 4 },

  pinnedBlock: { width: "100%", marginBottom: 2 },
  pinnedHeader: {
    flexDirection: "row-reverse", alignItems: "center",
    gap: 5, paddingBottom: 4,
  },
  pinnedRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, justifyContent: "flex-start" },
  pinnedTitle: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#C9A84C" },
  pinBadge: { position: "absolute", top: 4, right: 4 },
  pinnedSep: { width: "100%", height: 1, backgroundColor: "#E0E8E7", marginTop: 8, marginBottom: 2 },
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
