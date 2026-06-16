import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { Dimensions, Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

const GOLD = "#C9A84C";
const { width } = Dimensions.get("window");

export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const pulse = useSharedValue(1);
  const overlay = useSharedValue(1);
  const fadeIn = useSharedValue(0);

  useEffect(() => {
    // Fade in the logo
    fadeIn.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) });

    // Gentle pulse: scale 1 → 1.06 → 1, repeat 3 times
    pulse.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(1.07, { duration: 550, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 550, easing: Easing.inOut(Easing.sin) })
        ),
        3,
        false
      )
    );

    // Haptic on Android
    if (Platform.OS !== "web") {
      const t = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 200);
      overlay.value = withDelay(
        2400,
        withTiming(0, { duration: 350 }, (f) => { if (f) runOnJS(onDone)(); })
      );
      return () => clearTimeout(t);
    }
    overlay.value = withDelay(
      2400,
      withTiming(0, { duration: 350 }, (f) => { if (f) runOnJS(onDone)(); })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlay.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ scale: pulse.value }],
  }));

  const lineStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ scaleX: interpolate(fadeIn.value, [0, 1], [0, 1]) }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.overlay, overlayStyle]} pointerEvents="none">
      <Animated.View style={[styles.center, logoStyle]}>
        <Text style={styles.wordmark}>ملاذ</Text>
        <View style={styles.row}>
          {"MALAAZ".split("").map((l, i) => (
            <Text key={i} style={styles.latin}>{l}</Text>
          ))}
        </View>
        <Animated.View style={[styles.goldLine, lineStyle]} />
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
  },
  center: {
    alignItems: "center",
  },
  wordmark: {
    fontFamily: "Cairo_700Bold",
    fontSize: 96,
    color: GOLD,
    lineHeight: 130,
  },
  row: {
    flexDirection: "row",
    marginTop: -8,
  },
  latin: {
    fontFamily: "Cairo_700Bold",
    fontSize: 20,
    letterSpacing: 12,
    color: "rgba(201,168,76,0.85)",
  },
  goldLine: {
    width: 130,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: GOLD,
    marginTop: 20,
  },
});
