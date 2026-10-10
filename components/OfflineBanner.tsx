import { useSegments } from "expo-router";
import React from "react";
import { View } from "react-native";
import { Text } from "@/components/i18n";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();
  const segments = useSegments() as string[];
  // the consultation room / call screens show their own connection banner
  if (online || segments.includes("consult")) return null;
  return (
    <View style={{
      backgroundColor: "#CC2200",
      paddingVertical: 8,
      alignItems: "center",
      justifyContent: "center",
    }}>
      <Text style={{
        color: "#FFFFFF",
        fontFamily: "Cairo_600SemiBold",
        fontSize: 13,
        textAlign: "center",
      }}>
        ⚠️ لا يوجد اتصال بالإنترنت
      </Text>
    </View>
  );
}
