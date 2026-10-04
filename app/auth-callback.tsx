import { router } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { useMalaz } from "@/constants/malazTheme";

// Landing route for the Google sign-in deep link (<scheme>://auth-callback#access_token=...).
// The tokens are consumed in app/_layout.tsx; this screen only sends the user back to the login flow.
export default function AuthCallbackScreen() {
  const t = useMalaz();
  useEffect(() => {
    const id = setTimeout(() => router.replace("/client-auth"), 400);
    return () => clearTimeout(id);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={t.gold} />
    </View>
  );
}
