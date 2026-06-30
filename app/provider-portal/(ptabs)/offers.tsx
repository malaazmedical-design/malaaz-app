import React from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OfferCard } from "@/components/provider/OfferCard";
import { useProvider } from "@/contexts/ProviderContext";
import { useColors } from "@/hooks/useColors";

const DARK = "#1C2B2A";

export default function ProviderOffersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { offers, loadingOffers, refreshOffers } = useProvider();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: DARK, paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 20 }}>
        <Text style={{ color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 18, textAlign: "right" }}>عروض جديدة</Text>
        <Text style={{ color: "#FFFFFF99", fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right", marginTop: 2 }}>
          حجوزات قريبة منك — أول من يقبل يحجزها
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 30 }}
        refreshControl={<RefreshControl refreshing={loadingOffers} onRefresh={refreshOffers} />}
      >
        {offers.length === 0 ? (
          <View style={{ alignItems: "center", padding: 50 }}>
            <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 13, color: colors.mutedForeground }}>
              لا توجد عروض جديدة حالياً
            </Text>
          </View>
        ) : (
          offers.map((o) => <OfferCard key={o.id} offer={o} />)
        )}
      </ScrollView>
    </View>
  );
}
