import React, { useEffect, useRef } from "react";
import { View, type ViewStyle } from "react-native";
import { containRect, setIntroTarget } from "@/lib/introTarget";

// بيلف لوجو الهيدر ويسجّل مكانه على الشاشة للافتتاحية (LogoIntro)
export function IntroAnchor({ aspect, enabled = true, style, children }: {
  aspect: number; enabled?: boolean; style?: ViewStyle; children: React.ReactNode;
}) {
  const ref = useRef<View>(null);
  const measure = () => {
    if (!enabled) return;
    ref.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) setIntroTarget(containRect({ x, y, w, h }, aspect));
    });
  };
  useEffect(() => {
    if (!enabled) setIntroTarget(null);
    return () => setIntroTarget(null);
  }, [enabled]);
  return <View ref={ref} onLayout={measure} style={style}>{children}</View>;
}
