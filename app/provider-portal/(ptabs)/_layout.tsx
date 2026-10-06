import { Redirect, Tabs } from "expo-router";
import React from "react";

import ProviderTabBar from "@/components/provider/ProviderTabBar";
import { useProvider } from "@/contexts/ProviderContext";

export default function ProviderTabsLayout() {
  const { initializing, provider, offers } = useProvider();

  if (!initializing && !provider) return <Redirect href="/provider-portal/login" />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <ProviderTabBar {...props} />}>
      <Tabs.Screen name="overview" options={{ title: "نظرة عامة" }} />
      <Tabs.Screen name="bookings" options={{ title: "حجوزاتي" }} />
      <Tabs.Screen name="offers" options={{ title: "عروض جديدة", tabBarBadge: offers.length > 0 ? offers.length : undefined }} />
      <Tabs.Screen name="profile" options={{ title: "ملفي" }} />
      <Tabs.Screen name="cases" options={{ title: "استشارات" }} />
      <Tabs.Screen name="services" options={{ title: "خدماتي" }} />
    </Tabs>
  );
}
