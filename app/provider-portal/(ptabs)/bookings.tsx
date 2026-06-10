import React, { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BookingCard } from "@/components/provider/BookingCard";
import { useProvider } from "@/contexts/ProviderContext";
import { useColors } from "@/hooks/useColors";

const DARK = "#1C2B2A";
const GOLD = "#C9A84C";

const FILTERS = [
  { key: "all", label: "الكل" },
  { key: "pending", label: "جديد" },
  { key: "confirmed", label: "مؤكد" },
  { key: "completed", label: "مكتمل" },
] as const;

export default function ProviderBookingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { bookings, loadingBookings, refreshAll } = useProvider();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const filtered = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: DARK, paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 20 }}>
        <Text style={{ color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 18, textAlign: "right" }}>حجوزاتي</Text>
      </View>

      {/* Filters */}
      <View style={{ flexDirection: "row-reverse", gap: 8, padding: 14, paddingBottom: 6 }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = f.key === "all" ? bookings.length : bookings.filter((b) => b.status === f.key).length;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                backgroundColor: active ? DARK : colors.card,
                borderWidth: 1, borderColor: active ? GOLD : colors.border,
              }}
            >
              <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 12, color: active ? GOLD : colors.mutedForeground }}>
                {f.label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 30 }}
        refreshControl={<RefreshControl refreshing={loadingBookings} onRefresh={refreshAll} />}
      >
        {filtered.length === 0 ? (
          <View style={{ alignItems: "center", padding: 50 }}>
            <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 13, color: colors.mutedForeground }}>
              لا توجد حجوزات في هذه الفئة
            </Text>
          </View>
        ) : (
          filtered.map((b) => <BookingCard key={b.id} booking={b} />)
        )}
      </ScrollView>
    </View>
  );
}
