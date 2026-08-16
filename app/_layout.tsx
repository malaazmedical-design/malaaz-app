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
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import React, { useEffect, useState } from "react";
import { AppState, Platform, Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnimatedSplash } from "@/components/AnimatedSplash";
import { OfflineBanner } from "@/components/OfflineBanner";
import { AppProvider } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";

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
      <Stack.Screen
        name="mizo"
        options={{
          headerTintColor: "#C9A84C",
          headerStyle: { backgroundColor: "#1C2B2A" },
          headerTitle: () => (
            <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 22, color: "#C9A84C", letterSpacing: 1 }}>
              Malaaz
            </Text>
          ),
        }}
      />
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
      <Stack.Screen
        name="reset-password"
        options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }}
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

  // فتح شاشة الحجوزات لما المستخدم يضغط على أي إشعار
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.type === "medicine") {
        router.push("/medicines");
      } else if (data?.type === "OFFER_INSERT") {
        router.push("/provider-portal");
      } else {
        router.push("/(tabs)/bookings");
      }
    });
    return () => sub.remove();
  }, []);

  // فحص OTA تلقائي عند كل فتح للتطبيق (foreground) — يطبّق التحديث فوراً لو وجد
  useEffect(() => {
    if (Platform.OS === "web" || !Updates.isEnabled) return;

    const applyUpdate = async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } catch {}
    };

    applyUpdate();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") applyUpdate();
    });
    return () => sub.remove();
  }, []);

  // معالجة deep link لإعادة تعيين كلمة المرور
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url.includes("reset-password")) return;
      try {
        const fragment = url.split("#")[1] ?? "";
        const params = new URLSearchParams(fragment);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");
        if (type === "recovery" && accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          router.push("/reset-password");
        }
      } catch {}
    };

    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AppProvider>
                <OfflineBanner />
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
