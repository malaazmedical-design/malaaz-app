import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { Platform, StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

const GOLD = "#C9A84C";
const DARK = "#1C2B2A";

const LETTERS = ["M", "A", "L", "A", "A", "Z"];
const GAP  = 90;   // ms between each letter
const DUR  = 200;  // each letter fade+slide duration
const HOLD = 420;  // hold after last letter before fade-out
const FADE = 280;  // final overlay fade

// last letter finishes at: (5 × 90) + 200 = 650ms
// line starts at: 650 + 60 = 710ms
// overlay fade starts at: 650 + 420 = 1070ms
// total: 1070 + 280 ≈ 1350ms

function AnimLetter({ char, delay }: { char: string; delay: number }) {
  const opacity = useSharedValue(0);
  const ty      = useSharedValue(16);

  useEffect(() => {
    const ease = { duration: DUR, easing: Easing.out(Easing.quad) };
    opacity.value = withDelay(delay, withTiming(1, ease));
    ty.value      = withDelay(delay, withTiming(0, ease));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return <Animated.Text style={[styles.letter, style]}>{char}</Animated.Text>;
}

export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const overlay = useSharedValue(1);
  const lineW   = useSharedValue(0);

  const lastDone = (LETTERS.length - 1) * GAP + DUR;

  useEffect(() => {
    if (Platform.OS !== "web") {
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 80);
    }

    lineW.value = withDelay(
      lastDone + 60,
      withTiming(80, { duration: 260, easing: Easing.out(Easing.quad) })
    );

    overlay.value = withDelay(
      lastDone + HOLD,
      withTiming(0, { duration: FADE }, (finished) => {
        if (finished) runOnJS(onDone)();
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const lineStyle    = useAnimatedStyle(() => ({ width: lineW.value }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, styles.overlay, overlayStyle]}
      pointerEvents="none"
    >
      <Animated.View style={styles.row}>
        {LETTERS.map((ch, i) => (
          <AnimLetter key={i} char={ch} delay={i * GAP} />
        ))}
      </Animated.View>
      <Animated.View style={[styles.line, lineStyle]} />
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
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  letter: {
    fontFamily: "Cairo_700Bold",
    fontSize: 52,
    letterSpacing: 6,
    color: GOLD,
  },
  line: {
    height: 2,
    backgroundColor: GOLD,
    borderRadius: 1,
    marginTop: 10,
    opacity: 0.7,
  },
});
