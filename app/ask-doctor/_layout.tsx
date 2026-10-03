import { Stack } from "expo-router";
import React from "react";

export default function AskDoctorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ presentation: "card", animation: "slide_from_bottom" }} />
      <Stack.Screen name="[id]" options={{ presentation: "card", animation: "slide_from_right" }} />
    </Stack>
  );
}
