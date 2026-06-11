import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { Dimensions, Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInUp,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

const GOLD = "#C9A84C";
const LETTERS = ["M", "A", "L", "A", "A", "Z"];
const PARTICLES = 12;

// رذاذ ذهبي بيتطاير من مركز اللوجو
function Particle({ progress, index }: { progress: SharedValue<number>; index: number }) {
  const angle = (index / PARTICLES) * Math.PI * 2;
  const distance = 110 + (index % 3) * 38;
  const size = index % 2 === 0 ? 7 : 4;

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 1], [0, 1, 0]),
    transform: [
      { translateX: Math.cos(angle) * distance * progress.value },
      { translateY: Math.sin(angle) * distance * progress.value },
      { scale: interpolate(progress.value, [0, 1], [1, 0.3]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        { position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: GOLD },
        style,
      ]}
    />
  );
}

// افتتاحية ملاذ — ختم سينمائي سريع (~ثانيتين) وبعدها بتدوب على التطبيق
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const stamp = useSharedValue(0);        // نزول "ملاذ" بقوة
  const glow = useSharedValue(0);         // توهج ذهبي خلفي
  const sweep = useSharedValue(0);        // شعاع ضوء بيكنس
  const burst = useSharedValue(0);        // الرذاذ الذهبي
  const line = useSharedValue(0);         // الخط الذهبي
  const overlay = useSharedValue(1);      // ذوبان الشاشة كلها

  useEffect(() => {
    stamp.value = withSpring(1, { damping: 12, stiffness: 130, mass: 0.9 });
    glow.value = withDelay(150, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }));
    sweep.value = withDelay(420, withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }));
    burst.value = withDelay(280, withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) }));
    line.value = withDelay(550, withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }));

    // هزة خفيفة لحظة ما الختم بينزل
    if (Platform.OS !== "web") {
      const t = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 180);
      // الذوبان النهائي
      overlay.value = withDelay(
        1750,
        withTiming(0, { duration: 380 }, (f) => { if (f) runOnJS(onDone)(); })
      );
      return () => clearTimeout(t);
    }
    overlay.value = withDelay(
      1750,
      withTiming(0, { duration: 380 }, (f) => { if (f) runOnJS(onDone)(); })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlay.value,
    transform: [{ scale: interpolate(overlay.value, [0, 1], [1.08, 1]) }],
  }));

  const stampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(stamp.value, [0, 0.4, 1], [0, 0.7, 1]),
    transform: [{ scale: interpolate(stamp.value, [0, 1], [2.6, 1]) }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 0.5, 1], [0, 0.22, 0.1]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.4, 1.5]) }],
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sweep.value, [0, 0.15, 0.85, 1], [0, 0.5, 0.5, 0]),
    transform: [
      { translateX: interpolate(sweep.value, [0, 1], [-width * 0.9, width * 0.9]) },
      { rotate: "18deg" },
    ],
  }));

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: line.value }],
    opacity: line.value,
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.overlay, overlayStyle]} pointerEvents="none">
      {/* توهج ذهبي خلفي */}
      <Animated.View style={[styles.glow, glowStyle]} />

      {/* الرذاذ الذهبي */}
      <View style={styles.center} pointerEvents="none">
        {Array.from({ length: PARTICLES }).map((_, i) => (
          <Particle key={i} progress={burst} index={i} />
        ))}
      </View>

      {/* ختم "ملاذ" */}
      <Animated.View style={stampStyle}>
        <Text style={styles.wordmark}>ملاذ</Text>
      </Animated.View>

      {/* MALAAZ حرف حرف */}
      <View style={{ flexDirection: "row", marginTop: -6 }}>
        {LETTERS.map((l, i) => (
          <Animated.Text
            key={i}
            entering={FadeInUp.delay(380 + i * 65).springify().damping(13)}
            style={styles.latin}
          >
            {l}
          </Animated.Text>
        ))}
      </View>

      {/* خط ذهبي بيترسم */}
      <Animated.View style={[styles.goldLine, lineStyle]} />

      {/* السطر التعريفي */}
      <Animated.Text entering={FadeInUp.delay(850).duration(400)} style={styles.tagline}>
        رعاية طبية في بيتك… تستاهل الثقة
      </Animated.Text>

      {/* شعاع الضوء الكانس */}
      <Animated.View style={[styles.sweep, sweepStyle]}>
        <LinearGradient
          colors={["transparent", "rgba(255,240,200,0.55)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "#1C2B2A",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    overflow: "hidden",
  },
  center: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: width * 0.95,
    height: width * 0.95,
    borderRadius: width,
    backgroundColor: GOLD,
  },
  wordmark: {
    fontFamily: "Cairo_700Bold",
    fontSize: 96,
    color: GOLD,
    lineHeight: 130,
  },
  latin: {
    fontFamily: "Cairo_700Bold",
    fontSize: 20,
    letterSpacing: 12,
    color: "rgba(201,168,76,0.85)",
  },
  goldLine: {
    width: 150,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: GOLD,
    marginTop: 18,
  },
  tagline: {
    color: "#FFFFFF99",
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
    marginTop: 16,
    textAlign: "center",
  },
  sweep: {
    position: "absolute",
    width: 90,
    height: height * 1.4,
  },
});
