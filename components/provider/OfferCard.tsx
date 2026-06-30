import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { ProviderOffer, useProvider } from "@/contexts/ProviderContext";
import { useColors } from "@/hooks/useColors";

const GOLD = "#C9A84C";

export function OfferCard({ offer }: { offer: ProviderOffer }) {
  const colors = useColors();
  const { respondToOffer } = useProvider();
  const [busy, setBusy] = useState(false);

  const handle = (action: "accept" | "decline") => {
    Alert.alert(
      action === "accept" ? "قبول العرض" : "رفض العرض",
      action === "accept"
        ? "هتتعين على الحجز ده فوراً. تأكيد؟"
        : "متأكد إنك عايز ترفض العرض ده؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تأكيد",
          onPress: async () => {
            setBusy(true);
            try {
              const ok = await respondToOffer(offer.id, action);
              if (action === "accept" && !ok) {
                Alert.alert("للأسف", "العرض ده بقى مش متاح — على الأرجح اتقبل من مقدم تاني.");
              }
            } catch (e: any) {
              Alert.alert("خطأ", e.message ?? "تعذر تنفيذ الطلب");
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: GOLD }}>
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 14, color: colors.foreground, textAlign: "right" }}>
            {offer.service_type ?? "حجز جديد"}
            {offer.sub_option ? ` — ${offer.sub_option}` : ""}
          </Text>
          <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 11, color: colors.mutedForeground, textAlign: "right", marginTop: 2 }}>
            <MaterialCommunityIcons name="clock-outline" size={10} /> {offer.appointment_time ?? "—"} · {offer.area ?? "—"}
          </Text>
        </View>
        {offer.distance_km != null ? (
          <View style={{ backgroundColor: `${GOLD}18`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
            <Text style={{ color: GOLD, fontFamily: "Cairo_700Bold", fontSize: 11 }}>
              {Number(offer.distance_km).toFixed(1)} كم
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: "row-reverse", gap: 6, marginTop: 10 }}>
        <Pressable
          onPress={() => handle("accept")}
          disabled={busy}
          style={{ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: "#16A34A14", borderWidth: 1, borderColor: "#16A34A30", paddingVertical: 9, borderRadius: 9, opacity: busy ? 0.5 : 1 }}
        >
          <MaterialCommunityIcons name="check" size={14} color="#16A34A" />
          <Text style={{ color: "#16A34A", fontFamily: "Cairo_700Bold", fontSize: 12 }}>قبول</Text>
        </Pressable>
        <Pressable
          onPress={() => handle("decline")}
          disabled={busy}
          style={{ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: "#DC262614", borderWidth: 1, borderColor: "#DC262630", paddingVertical: 9, borderRadius: 9, opacity: busy ? 0.5 : 1 }}
        >
          <MaterialCommunityIcons name="close" size={14} color="#DC2626" />
          <Text style={{ color: "#DC2626", fontFamily: "Cairo_700Bold", fontSize: 12 }}>رفض</Text>
        </Pressable>
      </View>
    </View>
  );
}
