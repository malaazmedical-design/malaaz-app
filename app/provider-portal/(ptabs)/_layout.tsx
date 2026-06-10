import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import React from "react";

import { useProvider } from "@/contexts/ProviderContext";
import { useColors } from "@/hooks/useColors";

export default function ProviderTabsLayout() {
  const colors = useColors();
  const { initializing, provider, bookings } = useProvider();

  if (!initializing && !provider) return <Redirect href="/provider-portal/login" />;

  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#C9A84C",
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: "#1C2B2A", borderTopColor: "rgba(255,255,255,0.08)" },
        tabBarLabelStyle: { fontFamily: "Cairo_600SemiBold", fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="overview"
        options={{
          title: "نظرة عامة",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="chart-bar" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "حجوزاتي",
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="calendar-check" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: "خدماتي",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="layers" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "ملفي",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="doctor" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
