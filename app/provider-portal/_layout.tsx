import { Stack } from "expo-router";
import React from "react";

import { ProviderProvider } from "@/contexts/ProviderContext";

export default function ProviderPortalLayout() {
  return (
    <ProviderProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(ptabs)" />
      </Stack>
    </ProviderProvider>
  );
}
