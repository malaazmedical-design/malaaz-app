import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function BookingSuccessScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: "#1C2B2A", alignItems: "center", justifyContent: "center", padding: 32, paddingBottom: insets.bottom + 32 }}>
      <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: "#C9A84C22", borderWidth: 3, borderColor: "#C9A84C", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
        <MaterialCommunityIcons name="check-circle" size={56} color="#C9A84C" />
      </View>

      <Text style={{ color: "#C9A84C", fontFamily: "Cairo_700Bold", fontSize: 26, textAlign: "center", marginBottom: 12 }}>
        تم إرسال طلبك! 🎉
      </Text>
      <Text style={{ color: "#FFFFFF88", fontFamily: "Cairo_400Regular", fontSize: 15, textAlign: "center", lineHeight: 26, marginBottom: 40 }}>
        استلمنا طلبك وسيتواصل معك فريق ملاذ في أقرب وقت لتأكيد الموعد
      </Text>

      <View style={{ backgroundColor: "#FFFFFF0D", borderRadius: 18, padding: 20, width: "100%", marginBottom: 32, borderWidth: 1, borderColor: "#C9A84C33" }}>
        <InfoLine icon="clock-check-outline" text="سيتم التواصل معك خلال 30 دقيقة" />
        <InfoLine icon="phone" text="للاستفسار: 01039091989" />
        <InfoLine icon="whatsapp" text="واتساب: 01039091989" />
      </View>

      <Pressable
        onPress={() => router.replace("/(tabs)/bookings")}
        style={({ pressed }) => ({ width: "100%", backgroundColor: "#C9A84C", padding: 16, borderRadius: 16, alignItems: "center", transform: [{ scale: pressed ? 0.97 : 1 }], marginBottom: 12 })}
      >
        <Text style={{ color: "#1C2B2A", fontFamily: "Cairo_700Bold", fontSize: 16 }}>تابع حجوزاتي</Text>
      </Pressable>

      <Pressable
        onPress={() => router.replace("/(tabs)")}
        style={({ pressed }) => ({ width: "100%", padding: 16, borderRadius: 16, alignItems: "center", borderWidth: 1.5, borderColor: "#FFFFFF22", transform: [{ scale: pressed ? 0.97 : 1 }] })}
      >
        <Text style={{ color: "#FFFFFF88", fontFamily: "Cairo_600SemiBold", fontSize: 15 }}>العودة للرئيسية</Text>
      </Pressable>
    </View>
  );
}

function InfoLine({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <MaterialCommunityIcons name={icon as any} size={18} color="#C9A84C" />
      <Text style={{ color: "#FFFFFF99", fontFamily: "Cairo_400Regular", fontSize: 13 }}>{text}</Text>
    </View>
  );
}
