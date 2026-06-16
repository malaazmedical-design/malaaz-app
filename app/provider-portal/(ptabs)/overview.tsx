import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BookingCard } from "@/components/provider/BookingCard";
import { Card } from "@/components/ui";
import { useProvider } from "@/contexts/ProviderContext";
import { useColors } from "@/hooks/useColors";

const DARK = "#1C2B2A";
const GOLD = "#C9A84C";

export default function ProviderOverviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    provider,
    bookings,
    loadingBookings,
    refreshAll,
    toggleAvailability,
    logout,
  } = useProvider();

  if (!provider) return null;

  const total = bookings.length;
  const pending = bookings.filter((b) => b.status === "pending").length;
  const completed = bookings.filter((b) => b.status === "completed").length;
  const available = provider.is_available ?? false;

  const handleToggle = async (v: boolean) => {
    try {
      await toggleAvailability(v);
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "تعذر التحديث");
    }
  };

  const handleLogout = () => {
    Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "خروج",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/provider-portal/login");
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: DARK, paddingTop: insets.top + 12, paddingBottom: 18, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 18, textAlign: "right" }}>
              {provider.name}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right" }}>
              {provider.service_type}{provider.specialty ? ` — ${provider.specialty}` : ""}
            </Text>
          </View>
          <Pressable onPress={handleLogout} style={{ backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Cairo_600SemiBold", fontSize: 12 }}>
              <MaterialCommunityIcons name="logout" size={13} /> خروج
            </Text>
          </Pressable>
        </View>

        {/* متاح الآن */}
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 14, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 12 }}>
          <Text style={{ color: available ? "#4ade80" : "rgba(255,255,255,0.5)", fontFamily: "Cairo_700Bold", fontSize: 13 }}>
            {available ? "🟢 أنت متاح الآن — العملاء يمكنهم حجزك" : "⚫ أنت غير متاح حالياً"}
          </Text>
          <Switch
            value={available}
            onValueChange={handleToggle}
            trackColor={{ false: "#555", true: "#43A047" }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}
        refreshControl={<RefreshControl refreshing={loadingBookings} onRefresh={refreshAll} />}
      >
        {/* Stats */}
        <View style={{ flexDirection: "row-reverse", gap: 10, marginBottom: 16 }}>
          <StatCard emoji="📋" value={total} label="إجمالي حجوزاتي" />
          <StatCard emoji="⏳" value={pending} label="حجوزات جديدة" color="#DC2626" />
          <StatCard emoji="✅" value={completed} label="مكتملة" color="#16A34A" />
        </View>

        {/* Recent bookings */}
        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 15, color: colors.foreground }}>آخر حجوزاتي</Text>
          <Pressable onPress={() => router.push("/provider-portal/(ptabs)/bookings")}>
            <Text style={{ fontFamily: "Cairo_600SemiBold", fontSize: 12, color: GOLD }}>عرض الكل ←</Text>
          </Pressable>
        </View>

        {bookings.length === 0 ? (
          <Card style={{ padding: 30, alignItems: "center" }}>
            <Text style={{ fontFamily: "Cairo_400Regular", color: colors.mutedForeground, fontSize: 13 }}>
              لا توجد حجوزات بعد
            </Text>
          </Card>
        ) : (
          bookings.slice(0, 5).map((b) => <BookingCard key={b.id} booking={b} compact />)
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ emoji, value, label, color }: { emoji: string; value: number; label: string; color?: string }) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={{ fontSize: 24, fontFamily: "Cairo_700Bold", color: color ?? colors.foreground, marginTop: 2 }}>{value}</Text>
      <Text style={{ fontSize: 10, fontFamily: "Cairo_400Regular", color: colors.mutedForeground, textAlign: "center" }}>{label}</Text>
    </View>
  );
}
