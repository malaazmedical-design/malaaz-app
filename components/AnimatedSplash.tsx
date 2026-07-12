import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
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

const mizoImage = require("../assets/images/mizo.webp");

export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const fadeIn    = useSharedValue(0);
  const overlay   = useSharedValue(1);
  const mizoScale = useSharedValue(0.75);
  const mizoFloat = useSharedValue(0);

  useEffect(() => {
    // fade in
    fadeIn.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) });

    // ميزو يطلع بـ bounce
    mizoScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.4)) });

    // floating خفيف طول ما الـ splash شغّال
    mizoFloat.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0,   { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true
      )
    );

    if (Platform.OS !== "web") {
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 200);
    }

    // fade out
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
  const mizoStyle    = useAnimatedStyle(() => ({
    transform: [
      { scale: mizoScale.value },
      { translateY: mizoFloat.value },
    ],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, styles.overlay, overlayStyle]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.center, contentStyle]}>
        <Animated.View style={mizoStyle}>
          <Image source={mizoImage} style={styles.mizoImg} resizeMode="contain" />
        </Animated.View>

        <Text style={styles.greeting}>أهلاً! أنا ميزو</Text>
        <Text style={styles.sub}>مساعدك الطبي الذكي في ملاذ</Text>

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
  mizoImg: {
    width: 200,
    height: 200,
    borderRadius: 24,
    marginBottom: 8,
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
