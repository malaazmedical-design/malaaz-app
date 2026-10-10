import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Linking, Modal, Pressable, View } from "react-native";
import { Text } from "@/components/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TJ } from "@/constants/malazTheme";

// Full-screen image viewer (tap an attachment thumbnail to open it)
export function ImageViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,.94)", justifyContent: "center" }}>
        {uri ? <Image source={{ uri }} style={{ width: "100%", height: "80%" }} contentFit="contain" /> : null}
        <Pressable onPress={onClose} accessibilityLabel="إغلاق" style={{ position: "absolute", top: insets.top + 14, right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,.18)", alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="close" size={24} color="#fff" />
        </Pressable>
        <Pressable onPress={() => uri && Linking.openURL(uri).catch(() => {})} style={{ position: "absolute", bottom: insets.bottom + 24, alignSelf: "center", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,.18)" }}>
          <Text style={{ color: "#fff", fontFamily: TJ.bold, fontSize: 14 }}>فتح في المتصفح</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
