import { Stack } from "expo-router";
import React from "react";

import { IncomingOfferModal } from "@/components/provider/IncomingOfferModal";
import { ProviderProvider } from "@/contexts/ProviderContext";

export default function ProviderPortalLayout() {
  return (
    <ProviderProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(ptabs)" />
      </Stack>
      <IncomingOfferModal />
    </ProviderProvider>
  );
}
