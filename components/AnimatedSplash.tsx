import { Image } from "expo-image";
import React, { useEffect } from "react";
import { Dimensions, StyleSheet, Text } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");
const LOGO = width * 0.55;

// افتتاحية متحركة بهوية ملاذ — بتظهر مرة عند فتح التطبيق وبعدين بتدوب
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const logoScale = useSharedValue(0.4);
  const logoOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0.7);
  const ringOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const taglineY = useSharedValue(16);
  const overlayOpacity = useSharedValue(1);

  useEffect(() => {
    // اللوجو بينط للوسط
    logoOpacity.value = withTiming(1, { duration: 350 });
    logoScale.value = withSpring(1, { damping: 11, stiffness: 120 });

    // حلقة ذهبية بتنبض مرتين حوالين اللوجو
    ringOpacity.value = withDelay(
      250,
      withRepeat(
        withSequence(
          withTiming(0.45, { duration: 400 }),
          withTiming(0, { duration: 500 })
        ),
        2
      )
    );
    ringScale.value = withDelay(
      250,
      withRepeat(
        withSequence(
          withTiming(0.85, { duration: 0 }),
          withTiming(1.35, { duration: 900, easing: Easing.out(Easing.quad) })
        ),
        2
      )
    );

    // السطر التعريفي
    taglineOpacity.value = withDelay(700, withTiming(1, { duration: 450 }));
    taglineY.value = withDelay(700, withSpring(0, { damping: 14 }));

    // الذوبان وكشف التطبيق
    overlayOpacity.value = withDelay(
      2200,
      withTiming(0, { duration: 450 }, (finished) => {
        if (finished) runOnJS(onDone)();
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineY.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.overlay, overlayStyle]} pointerEvents="none">
      <Animated.View style={[styles.ring, ringStyle]} />
      <Animated.View style={logoStyle}>
        <Image
          source={require("../assets/images/splash-icon.png")}
          style={{ width: LOGO, height: LOGO }}
          contentFit="contain"
        />
      </Animated.View>
      <Animated.View style={taglineStyle}>
        <Text style={styles.tagline}>رعاية طبية في بيتك… تستاهل الثقة 💛</Text>
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
  ring: {
    position: "absolute",
    width: LOGO * 1.25,
    height: LOGO * 1.25,
    borderRadius: LOGO,
    borderWidth: 2,
    borderColor: "#C9A84C",
  },
  tagline: {
    color: "#FFFFFF99",
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
    marginTop: 26,
    textAlign: "center",
  },
});
