import React, { useEffect, useRef } from "react";
import { Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Mask, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { getIntroTarget } from "@/lib/introTarget";
import { LOGO_H, LOGO_PATHS, LOGO_W } from "./logoPaths";
import { PROVIDER_LOGO_H, PROVIDER_LOGO_MASK, PROVIDER_LOGO_PATHS, PROVIDER_LOGO_W } from "./providerLogoPaths";

type LogoSpec = {
  rest: number; dot: number; w: number; h: number;
  paths: { d: string; color: string; len: number }[];
  maskD: string;
};
const CLIENT_LOGO: LogoSpec = {
  rest: require("../assets/images/intro/logo-rest.png"), dot: require("../assets/images/intro/logo-dot.png"),
  w: LOGO_W, h: LOGO_H, paths: LOGO_PATHS, maskD: LOGO_PATHS.map((p) => p.d).join(" "),
};
const PROVIDER_LOGO: LogoSpec = {
  rest: require("../assets/images/intro/provider-rest.png"), dot: require("../assets/images/intro/provider-dot.png"),
  w: PROVIDER_LOGO_W, h: PROVIDER_LOGO_H, paths: PROVIDER_LOGO_PATHS, maskD: PROVIDER_LOGO_MASK,
};

// افتتاحية العميل: النقطة الدهبية، رسم اللوجو بخط، تعبئة اللون، لمعة، وتوهج دهبي هادي خلفه،
// وتحته "اختار • قارن • احجز". بعدها اللوجو بيرتفع شوية والشاشة تتلاشى.
const BG = "#F4F1EA";
const GOLD = "#C9A84C";
const ease = Easing.bezier(0.22, 0.8, 0.24, 1);
const easeIO = Easing.bezier(0.65, 0, 0.35, 1);

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

function TracePath({ d, color, len, progress }: { d: string; color: string; len: number; progress: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - progress.value) }));
  return (
    <AnimatedPath
      d={d}
      stroke={color}
      strokeWidth={4.5}
      strokeLinejoin="round"
      strokeLinecap="round"
      fill="none"
      strokeDasharray={[len, len]}
      animatedProps={props}
    />
  );
}

export function LogoIntro({ onDone, provider }: { onDone: () => void; provider?: boolean }) {
  const L = provider ? PROVIDER_LOGO : CLIENT_LOGO;
  const { width: sw } = useWindowDimensions();
  const w = Math.min(sw * (provider ? 0.66 : 0.74), 360);
  const h = (w * L.h) / L.w;

  const dot = useSharedValue(0);
  const trace = useSharedValue(0);
  const outline = useSharedValue(1);
  const fill = useSharedValue(0);
  const shine = useSharedValue(0);
  const tag = useSharedValue(0);
  const glow = useSharedValue(0);
  const breathe = useSharedValue(0);
  const exit = useSharedValue(0);
  // وجهة الطيران: مكان لوجو الهيدر لو معروف، وإلا الارتفاع والتلاشي
  const flyDx = useSharedValue(0);
  const flyDy = useSharedValue(0);
  const flyS = useSharedValue(0.65);
  const hasTarget = useSharedValue(0);
  const logoRef = useRef<View>(null);
  const bg = useSharedValue(1);

  useEffect(() => {
    glow.value = withDelay(200, withTiming(1, { duration: 1300, easing: ease }));
    breathe.value = withDelay(1500, withRepeat(withSequence(withTiming(1, { duration: 1300 }), withTiming(0, { duration: 1300 })), -1));
    dot.value = withDelay(150, withTiming(1, { duration: 600, easing: Easing.bezier(0.2, 0.9, 0.3, 1.15) }));
    trace.value = withDelay(450, withTiming(1, { duration: 1100, easing: ease }));
    fill.value = withDelay(1250, withTiming(1, { duration: 800, easing: ease }));
    outline.value = withDelay(1600, withTiming(0, { duration: 500 }));
    shine.value = withDelay(1750, withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }));
    tag.value = withDelay(1500, withTiming(1, { duration: 600, easing: ease }));
    // الخروج: اللوجو يطير لمكانه في هيدر الشاشة الرئيسية (لو معروف)، والتوهج والجملة يختفوا، وبعدها الخلفية
    const startExit = () => {
      const tg = getIntroTarget();
      const go = () => {
        exit.value = withTiming(1, { duration: 750, easing: easeIO });
        bg.value = withDelay(100, withTiming(0, { duration: 600, easing: Easing.inOut(Easing.quad) }, (finished) => {
          if (finished) runOnJS(onDone)();
        }));
      };
      if (tg && logoRef.current) {
        logoRef.current.measureInWindow((x, y, mw, mh) => {
          if (mw > 0 && mh > 0) {
            flyDx.value = tg.x + tg.w / 2 - (x + mw / 2);
            flyDy.value = tg.y + tg.h / 2 - (y + mh / 2);
            flyS.value = tg.w / mw;
            hasTarget.value = 1;
          }
          go();
        });
      } else go();
    };
    const timer = setTimeout(startExit, 2600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bgStyle = useAnimatedStyle(() => ({ opacity: bg.value }));
  const logoStyle = useAnimatedStyle(() => hasTarget.value
    ? { transform: [{ translateX: exit.value * flyDx.value }, { translateY: exit.value * flyDy.value }, { scale: 1 + exit.value * (flyS.value - 1) }], opacity: 1 }
    : { transform: [{ translateY: -exit.value * h * 0.6 }, { scale: 1 - exit.value * 0.35 }], opacity: 1 - exit.value * 0.6 });
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * (0.85 + breathe.value * 0.15) * (1 - exit.value),
    transform: [{ scale: 0.55 + glow.value * 0.45 }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: dot.value,
    transform: [{ translateY: -16 * (1 - dot.value) }, { scale: 0.4 + 0.6 * dot.value }],
  }));
  const restStyle = useAnimatedStyle(() => ({ opacity: fill.value }));
  const outlineStyle = useAnimatedStyle(() => ({ opacity: outline.value }));
  const tagStyle = useAnimatedStyle(() => ({
    opacity: tag.value * (1 - exit.value),
    transform: [{ translateY: 6 * (1 - tag.value) }],
  }));
  const shineProps = useAnimatedProps(() => ({ x: -L.w * 0.5 + shine.value * L.w * 1.6 }));
  const shineStyle = useAnimatedStyle(() => ({ opacity: shine.value > 0 && shine.value < 1 ? 1 : 0 }));

  const allD = L.maskD;

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.overlay]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: BG }, bgStyle]} />

      <Animated.View style={[{ position: "absolute", width: w * 1.5, height: w * 1.5 }, glowStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="g" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={GOLD} stopOpacity={0.3} />
              <Stop offset="0.32" stopColor={GOLD} stopOpacity={0.12} />
              <Stop offset="0.62" stopColor={GOLD} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#g)" />
        </Svg>
      </Animated.View>

      <Animated.View ref={logoRef} collapsable={false} style={[{ width: w, height: h }, logoStyle]}>
        <Animated.View style={[StyleSheet.absoluteFillObject, restStyle]}>
          <Image source={L.rest} style={{ width: w, height: h }} resizeMode="contain" />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFillObject, dotStyle]}>
          <Image source={L.dot} style={{ width: w, height: h }} resizeMode="contain" />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFillObject, outlineStyle]}>
          <Svg width={w} height={h} viewBox={`0 0 ${L.w} ${L.h}`}>
            {L.paths.map((p, i) => (
              <TracePath key={i} d={p.d} color={p.color} len={p.len} progress={trace} />
            ))}
          </Svg>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFillObject, shineStyle]}>
          <Svg width={w} height={h} viewBox={`0 0 ${L.w} ${L.h}`}>
            <Defs>
              <Mask id="m" x="0" y="0" width={L.w} height={L.h} maskUnits="userSpaceOnUse">
                <Path d={allD} fill="#fff" fillRule="evenodd" />
              </Mask>
              <LinearGradient id="s" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#fff" stopOpacity={0} />
                <Stop offset="0.5" stopColor="#fff" stopOpacity={0.85} />
                <Stop offset="1" stopColor="#fff" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <AnimatedRect y={0} width={L.w * 0.5} height={L.h} fill="url(#s)" mask="url(#m)" animatedProps={shineProps} />
          </Svg>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.tagRow, { top: "50%", marginTop: h / 2 + 22 }, tagStyle]}>
        <Text style={styles.tag}>اختار</Text>
        <View style={styles.sep} />
        <Text style={styles.tag}>قارن</Text>
        <View style={styles.sep} />
        <Text style={styles.tag}>احجز</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: "center", justifyContent: "center", zIndex: 999 },
  tagRow: { position: "absolute", flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  tag: { fontFamily: "Tajawal_700Bold", fontSize: 15, color: "#66767a" },
  sep: { width: 4, height: 4, borderRadius: 2, backgroundColor: GOLD },
});
