import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";

const DARK = "#1C2B2A";
const GOLD = "#C9A84C";

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (password.length < 6) {
      Alert.alert("تنبيه", "كلمة المرور لازم تكون 6 أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      Alert.alert("تنبيه", "كلمتا المرور غير متطابقتين");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert("تم ✅", "تم تغيير كلمة المرور بنجاح", [
        { text: "حسناً", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "حدث خطأ، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%" as const,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "right" as const,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: DARK }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 20,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 30,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{
          backgroundColor: "#243635",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
          borderRadius: 24,
          padding: 28,
        }}>
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <MaterialCommunityIcons name="lock-reset" size={48} color={GOLD} />
            <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 22, color: "#fff", marginTop: 12 }}>
              تعيين كلمة مرور جديدة
            </Text>
            <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 13, color: "rgba(255,255,255,0.45)", textAlign: "center", marginTop: 6 }}>
              أدخل كلمة المرور الجديدة
            </Text>
          </View>

          <TextInput
            style={inputStyle}
            placeholder="كلمة المرور الجديدة"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TextInput
            style={inputStyle}
            placeholder="تأكيد كلمة المرور"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />

          <Pressable
            onPress={handleReset}
            disabled={loading}
            style={({ pressed }) => ({
              flexDirection: "row-reverse",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: GOLD,
              borderRadius: 12,
              padding: 14,
              opacity: loading ? 0.6 : pressed ? 0.85 : 1,
              marginTop: 4,
            })}
          >
            <MaterialCommunityIcons name="check" size={18} color={DARK} />
            <Text style={{ color: DARK, fontFamily: "Cairo_700Bold", fontSize: 15 }}>
              {loading ? "جاري الحفظ..." : "حفظ كلمة المرور"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
