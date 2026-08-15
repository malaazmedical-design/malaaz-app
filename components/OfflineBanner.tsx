import React from "react";
import { Text, View } from "react-native";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
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
