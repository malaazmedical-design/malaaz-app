import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, Text, View } from "react-native";

import { useProvider } from "@/contexts/ProviderContext";
import { useColors } from "@/hooks/useColors";

const GOLD = "#C9A84C";

// popup فوري للعروض الجديدة — أول مقدم يرد يكسب الطلب (زي بوابة الموقع)
export function IncomingOfferModal() {
  const colors = useColors();
  const { incomingOffer, dismissIncomingOffer, respondToOffer } = useProvider();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!incomingOffer) return;
    const t = setTimeout(() => dismissIncomingOffer(), 60000);
    return () => clearTimeout(t);
  }, [incomingOffer, dismissIncomingOffer]);

  if (!incomingOffer) return null;

  const handle = async (action: "accept" | "decline") => {
    setBusy(true);
    try {
      const ok = await respondToOffer(incomingOffer.id, action);
      if (action === "accept" && !ok) {
        Alert.alert("للأسف", "العرض ده بقى مش متاح — على الأرجح اتقبل من مقدم تاني.");
      }
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "تعذر تنفيذ الطلب");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismissIncomingOffer}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 20, borderWidth: 2, borderColor: GOLD }}>
          <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 16, color: colors.foreground, textAlign: "center" }}>
            🔔 طلب جديد قريب منك
          </Text>
          <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 14, color: colors.foreground, textAlign: "center", marginTop: 10 }}>
            {incomingOffer.service_type ?? "حجز جديد"}
            {incomingOffer.sub_option ? ` — ${incomingOffer.sub_option}` : ""}
          </Text>
          <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 12, color: colors.mutedForeground, textAlign: "center", marginTop: 4 }}>
            {incomingOffer.area ?? "—"}
            {incomingOffer.distance_km != null ? ` · على بعد ${Number(incomingOffer.distance_km).toFixed(1)} كم منك` : ""}
          </Text>

          <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 18 }}>
            <Pressable
              onPress={() => handle("accept")}
              disabled={busy}
              style={{ flex: 1, alignItems: "center", backgroundColor: "#16A34A", paddingVertical: 12, borderRadius: 10, opacity: busy ? 0.6 : 1 }}
            >
              <Text style={{ color: "#fff", fontFamily: "Cairo_700Bold", fontSize: 14 }}>✅ قبول</Text>
            </Pressable>
            <Pressable
              onPress={() => handle("decline")}
              disabled={busy}
              style={{ flex: 1, alignItems: "center", backgroundColor: "#DC2626", paddingVertical: 12, borderRadius: 10, opacity: busy ? 0.6 : 1 }}
            >
              <Text style={{ color: "#fff", fontFamily: "Cairo_700Bold", fontSize: 14 }}>✖ رفض</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
