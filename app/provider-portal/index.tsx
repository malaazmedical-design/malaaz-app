import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useProvider } from "@/contexts/ProviderContext";
import { useColors } from "@/hooks/useColors";

export default function ProviderPortalIndex() {
  const colors = useColors();
  const { initializing, provider } = useProvider();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return provider ? (
    <Redirect href="/provider-portal/(ptabs)/overview" />
  ) : (
    <Redirect href="/provider-portal/login" />
  );
}
