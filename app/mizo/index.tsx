import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  SafeAreaView,
  Dimensions,
  Animated,
  Platform,
} from "react-native";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MIZO_CATEGORIES, MizoWord } from "@/constants/mizoWords";
import { MIZO_IMAGES } from "@/constants/mizoImages";

const { width } = Dimensions.get("window");
const COLS = 3;
const CARD_SIZE = (width - 48) / COLS;

type MizoState = "neutral" | "speaking" | "success" | "alert" | "thinking";

export default function MizoScreen() {
  const [activeCat, setActiveCat] = useState(MIZO_CATEGORIES[0].id);
  const [lastPhrase, setLastPhrase] = useState("اضغط على أي كلمة...");
  const [mizoState, setMizoState] = useState<MizoState>("neutral");
  const [subWords, setSubWords] = useState<MizoWord[] | null>(null);
  const mizoScale = useRef(new Animated.Value(1)).current;

  const bounceMizo = () => {
    Animated.sequence([
      Animated.spring(mizoScale, { toValue: 1.12, useNativeDriver: true, speed: 30 }),
      Animated.spring(mizoScale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
  };

  const speak = useCallback((phrase: string) => {
    Speech.stop();
    setLastPhrase(phrase);
    setMizoState("speaking");
    bounceMizo();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Speech.speak(phrase, {
      language: "ar-EG",
      rate: 0.82,
      pitch: 1.05,
      onDone: () => setMizoState("neutral"),
      onError: () => setMizoState("neutral"),
    });
  }, []);

  const handleWordPress = (word: MizoWord) => {
    if (word.children && word.children.length > 0) {
      setSubWords(word.children);
      setMizoState("thinking");
    } else {
      setSubWords(null);
      speak(word.phrase);
    }
  };

  const handleEmergency = () => {
    setMizoState("alert");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    speak("النجدة! أنا محتاج مساعدة فوراً!");
  };

  const handleYes = () => {
    setMizoState("success");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    speak("ايوه");
    setTimeout(() => setMizoState("neutral"), 1500);
  };

  const handleNo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    speak("لأ");
  };

  const handleRepeat = () => {
    if (lastPhrase && lastPhrase !== "اضغط على أي كلمة...") {
      speak(lastPhrase);
    }
  };

  const currentCategory = MIZO_CATEGORIES.find((c) => c.id === activeCat);
  const displayWords = subWords ?? currentCategory?.words ?? [];
  const mizoImage = MIZO_IMAGES[mizoState === "neutral" ? "neutral"
    : mizoState === "speaking" ? "speaking"
    : mizoState === "success" ? "success"
    : mizoState === "alert" ? "alert"
    : "thinking"];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-right" size={26} color="#C9A84C" />
        </Pressable>
        <Text style={styles.headerTitle}>ميزو</Text>
        <Pressable style={styles.settingsBtn}>
          <MaterialCommunityIcons name="cog-outline" size={24} color="#7A8A89" />
        </Pressable>
      </View>

      {/* Mizo mascot + last phrase */}
      <View style={styles.mizoRow}>
        <Animated.View style={{ transform: [{ scale: mizoScale }] }}>
          <Image source={mizoImage} style={styles.mizoImg} resizeMode="contain" />
        </Animated.View>
        <View style={styles.phraseBox}>
          <Pressable onPress={handleRepeat} style={styles.phraseInner}>
            <MaterialCommunityIcons name="volume-high" size={20} color="#C9A84C" />
            <Text style={styles.phraseText} numberOfLines={2}>{lastPhrase}</Text>
          </Pressable>
        </View>
      </View>

      {/* Yes / No */}
      <View style={styles.yesNoRow}>
        <Pressable style={[styles.yesNoBtn, styles.noBtn]} onPress={handleNo}>
          <Text style={styles.yesNoText}>❌  لأ</Text>
        </Pressable>
        <Pressable style={[styles.yesNoBtn, styles.yesBtn]} onPress={handleYes}>
          <Text style={styles.yesNoText}>✅  ايوه</Text>
        </Pressable>
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catBar}
      >
        {subWords && (
          <Pressable
            style={[styles.catTab, styles.catTabBack]}
            onPress={() => setSubWords(null)}
          >
            <Text style={styles.catTabText}>↩ رجوع</Text>
          </Pressable>
        )}
        {MIZO_CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            style={[styles.catTab, activeCat === cat.id && !subWords && styles.catTabActive]}
            onPress={() => { setActiveCat(cat.id); setSubWords(null); }}
          >
            <Text style={styles.catTabText}>{cat.emoji} {cat.label}</Text>
          </Pressable>
        ))}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F5F7F6",
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1C2B2A",
  },
  headerTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 20,
    color: "#C9A84C",
  },
  backBtn: { padding: 4 },
  settingsBtn: { padding: 4 },

  mizoRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#1C2B2A",
    gap: 12,
  },
  mizoImg: {
    width: 80,
    height: 80,
  },
  phraseBox: {
    flex: 1,
    backgroundColor: "#253D3B",
    borderRadius: 14,
    padding: 2,
  },
  phraseInner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    padding: 10,
  },
  phraseText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
    textAlign: "right",
    flex: 1,
  },

  yesNoRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  yesNoBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  yesBtn: { backgroundColor: "#1C6B3A" },
  noBtn:  { backgroundColor: "#8B1A1A" },
  yesNoText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    color: "#FFFFFF",
  },

  catBar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    flexDirection: "row-reverse",
  },
  catTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#E8EDEC",
  },
  catTabActive: {
    backgroundColor: "#1C2B2A",
  },
  catTabBack: {
    backgroundColor: "#C9A84C22",
    borderWidth: 1,
    borderColor: "#C9A84C",
  },
  catTabText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
    color: "#1C2B2A",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    justifyContent: "flex-end",
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1.5,
    borderColor: "#E0E8E7",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardPressed: {
    backgroundColor: "#EDF5F4",
    transform: [{ scale: 0.95 }],
  },
  cardEmoji: {
    fontSize: 34,
  },
  cardLabel: {
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    color: "#1C2B2A",
    textAlign: "center",
  },
  cardArrow: {
    position: "absolute",
    top: 6,
    left: 8,
    fontSize: 18,
    color: "#C9A84C",
    fontWeight: "700",
  },

  emergencyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#CC2200",
    marginHorizontal: 12,
    marginBottom: Platform.OS === "ios" ? 8 : 12,
    paddingVertical: 16,
    borderRadius: 16,
  },
  emergencyText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 20,
    color: "#FFFFFF",
  },
});
