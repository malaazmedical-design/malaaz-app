import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Platform, Pressable, View } from "react-native";
import { Text } from "@/components/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AskForm } from "@/components/ask/AskForm";
import { TJ, useMalaz } from "@/constants/malazTheme";

// Edit screen for an existing question (new questions are written in the "سؤال مجاني" tab)
export default function NewCaseScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const webTop = Platform.OS === "web" ? 67 : 0;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top + 12 + webTop, paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="رجوع" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="arrow-right" size={22} color={t.text} />
        </Pressable>
        <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 22 }}>{edit ? "تعديل سؤالك" : "سؤال جديد"}</Text>
      </View>
      <AskForm edit={edit} onSent={(id) => router.replace(`/ask-doctor/${id}`)} onCancelEdit={() => router.back()} />
    </View>
  );
}
