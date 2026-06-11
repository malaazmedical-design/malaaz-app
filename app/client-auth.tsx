import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";

const DARK = "#1C2B2A";
const GOLD = "#C9A84C";

export default function ClientAuthScreen() {
  const insets = useSafeAreaInsets();
  const { clientLogin, clientRegister, clientResetPassword } = useApp();

  const [tab, setTab] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [rName, setRName] = useState("");
  const [rPhone, setRPhone] = useState("");
  const [rEmail, setREmail] = useState("");
  const [rPass, setRPass] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !pass) { setError("أدخل البريد وكلمة المرور"); return; }
    setError(""); setBusy(true);
    try {
      await clientLogin(email.trim(), pass);
      router.back();
    } catch (e: any) {
      setError(e.message ?? "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    if (!rName.trim() || !rPhone.trim() || !rEmail.trim() || !rPass) {
      setError("املأ كل الحقول"); return;
    }
    if (!/^01[0125]\d{8}$/.test(rPhone.trim().replace(/\s/g, ""))) {
      setError("رقم الموبايل غير صحيح"); return;
    }
    if (rPass.length < 6) { setError("كلمة المرور 6 أحرف على الأقل"); return; }
    setError(""); setBusy(true);
    try {
      await clientRegister({
        name: rName.trim(),
        phone: rPhone.trim().replace(/\s/g, ""),
        email: rEmail.trim(),
        password: rPass,
      });
      Alert.alert("أهلاً بيك في ملاذ 🎉", "تم إنشاء حسابك بنجاح");
      router.back();
    } catch (e: any) {
      setError(e.message ?? "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    if (!email.trim()) { setError("أدخل بريدك الإلكتروني أولاً"); return; }
    try {
      await clientResetPassword(email.trim());
      Alert.alert("تم", "✅ تم إرسال رابط إعادة تعيين كلمة المرور على بريدك");
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "حدث خطأ");
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: DARK }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          style={{ position: "absolute", top: insets.top + 12, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}
        >
          <MaterialCommunityIcons name="chevron-right" size={24} color="#FFFFFF" />
        </Pressable>

        <View style={{ backgroundColor: "#243635", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 24, padding: 28 }}>
          <Text style={{ fontSize: 34, fontFamily: "Cairo_700Bold", color: "#FFFFFF", textAlign: "center" }}>ملاذ</Text>
          <Text style={{ fontSize: 11, letterSpacing: 4, color: GOLD, opacity: 0.8, textAlign: "center", marginBottom: 4 }}>MALAAZ</Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", textAlign: "center", marginBottom: 22, fontFamily: "Cairo_400Regular" }}>
            حسابك بيحفظ بياناتك وعناوينك وكل حجوزاتك — على الموقع والتطبيق
          </Text>

          {/* Tabs */}
          <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 20 }}>
            {([["login", "دخول"], ["register", "حساب جديد"]] as const).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => { setTab(key); setError(""); }}
                style={{
                  flex: 1, padding: 11, borderRadius: 10, alignItems: "center",
                  borderWidth: 1.5,
                  borderColor: tab === key ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.1)",
                  backgroundColor: tab === key ? "rgba(201,168,76,0.12)" : "transparent",
                }}
              >
                <Text style={{ fontSize: 13, fontFamily: "Cairo_700Bold", color: tab === key ? GOLD : "rgba(255,255,255,0.5)" }}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {error ? (
            <Text style={{ color: "#ff6b6b", fontSize: 12, fontFamily: "Cairo_600SemiBold", textAlign: "center", marginBottom: 10 }}>{error}</Text>
          ) : null}

          {tab === "login" ? (
            <>
              <TextInput style={inputStyle} placeholder="البريد الإلكتروني" placeholderTextColor="rgba(255,255,255,0.3)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              <TextInput style={inputStyle} placeholder="كلمة المرور" placeholderTextColor="rgba(255,255,255,0.3)" value={pass} onChangeText={setPass} secureTextEntry />
              <GoldButton label={busy ? "جاري الدخول..." : "دخول"} icon="login" onPress={handleLogin} disabled={busy} />
              <Pressable onPress={handleForgot} style={{ marginTop: 14 }}>
                <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, textAlign: "center", fontFamily: "Cairo_400Regular" }}>نسيت كلمة المرور؟</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput style={inputStyle} placeholder="الاسم الكامل" placeholderTextColor="rgba(255,255,255,0.3)" value={rName} onChangeText={setRName} />
              <TextInput style={inputStyle} placeholder="رقم الموبايل (01xxxxxxxxx)" placeholderTextColor="rgba(255,255,255,0.3)" value={rPhone} onChangeText={setRPhone} keyboardType="phone-pad" />
              <TextInput style={inputStyle} placeholder="البريد الإلكتروني" placeholderTextColor="rgba(255,255,255,0.3)" value={rEmail} onChangeText={setREmail} autoCapitalize="none" keyboardType="email-address" />
              <TextInput style={inputStyle} placeholder="كلمة المرور (6 أحرف على الأقل)" placeholderTextColor="rgba(255,255,255,0.3)" value={rPass} onChangeText={setRPass} secureTextEntry />
              <GoldButton label={busy ? "جاري الإنشاء..." : "إنشاء حساب"} icon="account-plus" onPress={handleRegister} disabled={busy} />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function GoldButton({ label, icon, onPress, disabled }: {
  label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  onPress: () => void; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8,
        backgroundColor: GOLD, borderRadius: 12, padding: 14,
        opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
      })}
    >
      <MaterialCommunityIcons name={icon} size={18} color={DARK} />
      <Text style={{ color: DARK, fontFamily: "Cairo_700Bold", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}
