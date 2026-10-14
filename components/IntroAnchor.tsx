import React, { useEffect, useRef } from "react";
import { View, type ViewStyle } from "react-native";
import { containRect, setIntroMeasurer, unsetIntroMeasurer, type IntroTarget } from "@/lib/introTarget";

// بيلف لوجو الهيدر ويسجّل طريقة قياس مكانه على الشاشة للافتتاحية (LogoIntro)
export function IntroAnchor({ aspect, enabled = true, dark = false, style, children }: {
  aspect: number; enabled?: boolean; dark?: boolean; style?: ViewStyle; children: React.ReactNode;
}) {
  const ref = useRef<View>(null);
  useEffect(() => {
    if (!enabled) return;
    const measurer = (cb: (t: IntroTarget | null) => void) => {
      const node = ref.current;
      if (!node) return cb(null);
      node.measureInWindow((x, y, w, h) => cb(w > 0 && h > 0 ? { ...containRect({ x, y, w, h }, aspect), dark } : null));
    };
    setIntroMeasurer(measurer);
    return () => unsetIntroMeasurer(measurer);
  }, [enabled, aspect, dark]);
  return <View ref={ref} collapsable={false} style={style}>{children}</View>;
}
