import { Image } from "expo-image";
import React from "react";
import { StyleProp, Text, View, ViewStyle } from "react-native";

import { TJ, useMalaz } from "@/constants/malazTheme";
import type { Provider } from "@/constants/data";

export function hasProviderPhoto(p: Pick<Provider, "avatar">): boolean {
  return !!p.avatar && typeof p.avatar === "object" && "uri" in p.avatar;
}

// Real photo when the provider uploaded one, otherwise the first letter of their name.
export function ProviderAvatar({ provider, style, letterSize }: { provider: Pick<Provider, "avatar" | "name">; style?: StyleProp<ViewStyle>; letterSize: number }) {
  const t = useMalaz();
  if (hasProviderPhoto(provider)) {
    return <Image source={provider.avatar} style={style as any} contentFit="cover" />;
  }
  return (
    <View style={[{ backgroundColor: t.ic, alignItems: "center", justifyContent: "center", overflow: "hidden" }, style]}>
      <Text style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: letterSize }}>{(provider.name || "؟").trim().charAt(0)}</Text>
    </View>
  );
}
