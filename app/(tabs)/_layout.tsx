import { BlurView } from "expo-blur";
import { Redirect, Tabs, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/mizoStorage";
import { useApp } from "@/contexts/AppContext";
import MalazTabBar from "@/components/MalazTabBar";
import { IS_PROVIDER_APP } from "@/lib/appVariant";

// The standalone Malaaz Provider app opens straight on the provider portal.
export default function TabLayout() {
  if (IS_PROVIDER_APP) return <Redirect href="/provider-portal" />;
  return <ClientTabLayout />;
}

function ClientTabLayout() {
  const colors = useColors();
  const isIOS = Platform.OS === "ios";
  const { client } = useApp();
  const showMizo = !!client;

  useEffect(() => {
    (async () => {
      // وضع المريض — يحوّل لشاشة ميزو المقفلة فوراً بدون أي شاشات تانية
      try {
        const profile = await getProfile();
        if (profile.patientMode) {
          router.replace("/mizo/locked");
          return;
        }
      } catch {}

      // مقدم خدمة — يحوّله لبوابته
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const { data } = await supabase
          .from("providers")
          .select("id, status")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (data && data.status === "active") {
          router.replace("/provider-portal");
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <Tabs
      tabBar={(props) => <MalazTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: "#C9A84C",
        tabBarInactiveTintColor: "#7A8A89",
        headerShown: false,
        tabBarLabelStyle: { fontFamily: "Cairo_600SemiBold", fontSize: 11 },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : "#1C2B2A",
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#1C2B2A" }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="home-variant" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "حجوزاتي",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="calendar-check" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ask-doctor-entry"
        options={{
          title: "إسأل طبيب",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="stethoscope" size={24} color={color} />
          ),
          tabBarButton: (props) => (
            <Pressable
              style={props.style}
              onPress={() => router.push("/ask-doctor")}
              accessibilityRole="button"
              accessibilityLabel="إسأل طبيب"
            >
              {props.children}
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="mizo-entry"
        options={{
          title: "ميزو",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="robot-happy-outline" size={24} color={color} />
          ),
          tabBarButton: (props) => (
            <Pressable
              style={props.style}
              onPress={() => router.push("/mizo")}
              accessibilityRole="button"
              accessibilityLabel="ميزو"
            >
              {props.children}
            </Pressable>
          ),
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "حسابي",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="account-circle" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
