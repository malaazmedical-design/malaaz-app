import { Stack } from "expo-router";

export default function MizoLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="locked" options={{ gestureEnabled: false }} />
      <Stack.Screen name="settings" />
      <Stack.Screen name="history" />
      <Stack.Screen name="care-report" />
      <Stack.Screen name="family" />
      <Stack.Screen name="pain" />
      <Stack.Screen name="contacts" />
    </Stack>
  );
}
