import "react-native-url-polyfill/auto";
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from "@expo-google-fonts/cairo";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnimatedSplash } from "@/components/AnimatedSplash";
import { AppProvider } from "@/contexts/AppContext";

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

// عرض الإشعارات حتى والتطبيق مفتوح
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "رجوع" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="mizo" options={{ title: "Malaaz", headerTintColor: "#C9A84C", headerStyle: { backgroundColor: "#1C2B2A" }, headerTitleStyle: { fontFamily: "Cairo_700Bold", color: "#C9A84C" } }} />
      <Stack.Screen
        name="provider/[id]"
        options={{ headerShown: false, presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="quick-request"
        options={{ headerShown: false, presentation: "card", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="booking-success"
        options={{ headerShown: false, presentation: "modal", gestureEnabled: false }}
      />
      <Stack.Screen
        name="rate/[bookingId]"
        options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="provider-portal"
        options={{ headerShown: false, animation: "slide_from_left" }}
      />
      <Stack.Screen
        name="client-auth"
        options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="medicines"
        options={{ headerShown: false, animation: "slide_from_left" }}
      />
      <Stack.Screen
        name="family/[id]"
        options={{ headerShown: false, animation: "slide_from_left" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    Cairo_400Regular, Cairo_500Medium, Cairo_600SemiBold, Cairo_700Bold,
  });
  // الافتتاحية المتحركة — على الموبايل بس (الويب بيفتح مباشرة)
  const [introDone, setIntroDone] = useState(Platform.OS === "web");

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AppProvider>
                <RootLayoutNav />
                {!introDone ? <AnimatedSplash onDone={() => setIntroDone(true)} /> : null}
              </AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
