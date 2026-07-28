import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useRef, useState } from "react";
import {
  Animated, Modal, Pressable, StyleSheet, Text, View,
} from "react-native";

const KEY = "mizo_onboarding_done_v1";

const SLIDES = [
  {
    emoji: "🤖",
    title: "أهلاً بيك في Malaaz ReVoice!",
    desc: "مساعدك الذكي للتواصل\nبيتكلم عنك من غير ما تحتاج تتكلم",
    hint: null,
  },
  {
    emoji: "👆",
    title: "اضغط على أي بطاقة",
    desc: "Malaaz ReVoice بيقرأها بصوت عالي عنك",
    hint: "مثال:  💧 مية  →  «أنا عايز مية»",
  },
  {
    emoji: "✅  ❌  🔔",
    title: "ردود سريعة وجرس",
    desc: "ايوه / لأ في الأعلى للرد فوراً\nاضغط 🔔 وينادي الأهل عندك",
    hint: null,
  },
  {
    emoji: "🆘",
    title: "زرار الطوارئ",
    desc: "موجود في أسفل الشاشة دايماً\nاضغطه لو محتاج مساعدة فورية",
    hint: "التابات فوق للتنقل بين المواضيع\nأكل — صحة — مشاعر — دعاء...",
  },
];

export async function checkOnboardingDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch { return false; }
}

export async function markOnboardingDone(): Promise<void> {
  try { await AsyncStorage.setItem(KEY, "1"); } catch {}
}

export default function MizoOnboarding({ onDone }: { onDone: () => void }) {
  const [slide, setSlide] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animateNext = (cb: () => void) => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(translateX, { toValue: -30, duration: 140, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]),
    ]).start(() => {
      translateX.setValue(30);
      cb();
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const goNext = async () => {
    if (slide < SLIDES.length - 1) {
      animateNext(() => setSlide((s) => s + 1));
    } else {
      await markOnboardingDone();
      onDone();
    }
  };

  const skip = async () => {
    await markOnboardingDone();
    onDone();
  };

  const s = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* Top row: skip + dots */}
          <View style={styles.topRow}>
            <Pressable onPress={skip} hitSlop={12}>
              <Text style={styles.skipText}>تخطي</Text>
            </Pressable>
            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <View key={i} style={[styles.dot, i === slide && styles.dotActive]} />
              ))}
            </View>
          </View>

          {/* Animated slide content */}
          <Animated.View
            style={[styles.content, { transform: [{ translateX }], opacity }]}
          >
            <Text style={styles.emoji}>{s.emoji}</Text>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.desc}>{s.desc}</Text>
            {s.hint ? (
              <View style={styles.hintBox}>
                <Text style={styles.hintText}>{s.hint}</Text>
              </View>
            ) : null}
          </Animated.View>

          {/* CTA button */}
          <Pressable
            onPress={goNext}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>
              {isLast ? "فهمت! هنبدأ  🚀" : "التالي  ←"}
            </Text>
          </Pressable>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000BB",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#1C2B2A",
    borderRadius: 28,
    padding: 26,
    width: "88%",
    maxWidth: 420,
    alignItems: "center",
    gap: 18,
    borderWidth: 1.5,
    borderColor: "#C9A84C44",
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  topRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  skipText: {
    fontFamily: "Cairo_400Regular",
    fontSize: 13,
    color: "#7A8A89",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2E4140",
  },
  dotActive: {
    backgroundColor: "#C9A84C",
    width: 26,
  },
  content: {
    alignItems: "center",
    gap: 12,
    width: "100%",
    minHeight: 220,
    justifyContent: "center",
  },
  emoji: {
    fontSize: 64,
    textAlign: "center",
    marginBottom: 4,
  },
  title: {
    fontFamily: "Cairo_700Bold",
    fontSize: 22,
    color: "#FFFFFF",
    textAlign: "center",
  },
  desc: {
    fontFamily: "Cairo_400Regular",
    fontSize: 15,
    color: "#B0C4C2",
    textAlign: "center",
    lineHeight: 28,
  },
  hintBox: {
    backgroundColor: "#C9A84C15",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#C9A84C33",
    marginTop: 4,
    width: "100%",
  },
  hintText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
    color: "#C9A84C",
    textAlign: "center",
    lineHeight: 22,
  },
  btn: {
    backgroundColor: "#C9A84C",
    borderRadius: 14,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
  },
  btnPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  btnText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 17,
    color: "#1C2B2A",
  },
});
