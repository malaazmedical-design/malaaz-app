import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const GOLD = "#C9A84C";
const DARK = "#1C2B2A";
const TOTAL_MS = 5000;

export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const fadeIn   = useSharedValue(0);
  const overlay  = useSharedValue(1);
  const waveRot  = useSharedValue(0);
  const botScale = useSharedValue(0.8);

  useEffect(() => {
    // fade in + robot pops in
    fadeIn.value   = withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) });
    botScale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.5)) });

    // wave: 3 cycles, each = 5 flicks then rest
    waveRot.value = withDelay(
      350,
      withRepeat(
        withSequence(
          withTiming(-28, { duration: 220, easing: Easing.inOut(Easing.sin) }),
          withTiming(12,  { duration: 220, easing: Easing.inOut(Easing.sin) }),
          withTiming(-28, { duration: 220, easing: Easing.inOut(Easing.sin) }),
          withTiming(12,  { duration: 220, easing: Easing.inOut(Easing.sin) }),
          withTiming(-28, { duration: 220, easing: Easing.inOut(Easing.sin) }),
          withTiming(0,   { duration: 350, easing: Easing.out(Easing.quad) }),
          withDelay(700, withTiming(0)),   // استراحة بين كل تحية والتانية
        ),
        3,
        false
      )
    );

    if (Platform.OS !== "web") {
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 200);
    }

    // fade out بعد TOTAL_MS
    overlay.value = withDelay(
      TOTAL_MS - 400,
      withTiming(0, { duration: 400 }, (finished) => {
        if (finished) runOnJS(onDone)();
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: fadeIn.value }));
  const robotStyle   = useAnimatedStyle(() => ({
    transform: [{ scale: botScale.value }],
  }));
  const waveStyle    = useAnimatedStyle(() => ({
    transform: [
      { translateY: 10 },
      { rotate: `${waveRot.value}deg` },
      { translateY: -10 },
    ],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, styles.overlay, overlayStyle]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.center, contentStyle]}>
        {/* الروبوت + الإيد */}
        <View style={styles.robotWrap}>
          <Animated.View style={robotStyle}>
            <Text style={styles.robot}>🤖</Text>
          </Animated.View>
          <Animated.View style={[styles.waveWrap, waveStyle]}>
            <Text style={styles.wave}>👋</Text>
          </Animated.View>
        </View>

        {/* التحية */}
        <Text style={styles.greeting}>أهلاً! أنا ميزو</Text>
        <Text style={styles.sub}>مساعدك الطبي الذكي في ملاذ</Text>

        {/* الماركة */}
        <Text style={styles.brand}>MALAAZ</Text>
        <View style={styles.goldLine} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: DARK,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  center: {
    alignItems: "center",
  },
  robotWrap: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  robot: {
    fontSize: 100,
    lineHeight: 120,
  },
  waveWrap: {
    position: "absolute",
    top: 6,
    right: -2,
  },
  wave: {
    fontSize: 38,
  },
  greeting: {
    fontFamily: "Cairo_700Bold",
    fontSize: 26,
    color: "#FFFFFF",
    marginTop: 10,
    textAlign: "center",
  },
  sub: {
    fontFamily: "Cairo_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.45)",
    marginTop: 8,
    textAlign: "center",
  },
  brand: {
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    letterSpacing: 8,
    color: GOLD,
    marginTop: 32,
  },
  goldLine: {
    width: 80,
    height: 2,
    backgroundColor: GOLD,
    borderRadius: 1,
    marginTop: 10,
    opacity: 0.7,
  },
});
