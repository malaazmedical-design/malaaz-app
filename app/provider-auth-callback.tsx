import { router } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { useMalaz } from "@/constants/malazTheme";

// Landing route for the provider Google sign-in deep link. Tokens are consumed in app/_layout.tsx.
export default function ProviderAuthCallbackScreen() {
  const t = useMalaz();
  useEffect(() => {
    const id = setTimeout(() => router.replace("/provider-portal/login"), 400);
    return () => clearTimeout(id);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={t.gold} />
    </View>
  );
}
