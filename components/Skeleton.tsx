import React, { useEffect } from "react";
import { DimensionValue, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { useMalaz } from "@/constants/malazTheme";

// Pulsing gray placeholder shown in lists while data loads (final design: "هياكل رمادية نابضة").
export function Skel({ w = "100%", h = 14, r = 8, style }: { w?: DimensionValue; h?: number; r?: number; style?: ViewStyle }) {
  const t = useMalaz();
  const o = useSharedValue(0.45);
  useEffect(() => { o.value = withRepeat(withTiming(0.95, { duration: 800 }), -1, true); }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: t.btn }, a, style]} />;
}

// A card-shaped skeleton: avatar + two text lines + a right-side chip.
export function SkeletonCards({ count = 4, avatar = false, padded = true }: { count?: number; avatar?: boolean; padded?: boolean }) {
  const t = useMalaz();
  return (
    <View style={{ gap: 10, padding: padded ? 16 : 0 }} accessibilityLabel="جاري التحميل">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 20, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
            {avatar ? <Skel w={52} h={52} r={26} /> : null}
            <View style={{ flex: 1, gap: 8 }}>
              <Skel w="55%" h={15} />
              <Skel w="35%" h={12} />
            </View>
            <Skel w={64} h={24} r={12} />
          </View>
          <Skel w="90%" h={12} />
        </View>
      ))}
    </View>
  );
}

// Horizontal provider cards (home carousel)
export function SkeletonCarousel() {
  const t = useMalaz();
  return (
    <View style={{ flexDirection: "row-reverse", gap: 12, paddingHorizontal: 16, paddingVertical: 8 }} accessibilityLabel="جاري التحميل">
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 168, padding: 8, borderRadius: 22, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, gap: 8 }}>
          <Skel h={128} r={16} />
          <Skel w="70%" h={15} />
          <Skel w="50%" h={12} />
          <Skel w="40%" h={14} />
        </View>
      ))}
    </View>
  );
}
