import React from "react";
import { StyleSheet, Text, TextProps } from "react-native";

import { useProviderPrefs } from "@/lib/providerPrefs";

// Text that honours the provider's "حجم الخط" setting.
export function PText({ style, ...rest }: TextProps) {
  const { fontScale } = useProviderPrefs();
  const flat = StyleSheet.flatten(style) ?? {};
  const scaled = typeof flat.fontSize === "number" ? { fontSize: Math.round(flat.fontSize * fontScale * 10) / 10 } : null;
  return <Text {...rest} style={[style, scaled]} />;
}
