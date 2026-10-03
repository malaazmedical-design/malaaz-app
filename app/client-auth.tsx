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

import { Image } from "expo-image";

import { TJ, useMalaz } from "@/constants/malazTheme";
import { useApp } from "@/contexts/AppContext";

export default function ClientAuthScreen() {
  const insets = useSafeAreaInsets();
  const t = useMalaz();
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
    height: 54,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    fontSize: 14,
    fontFamily: TJ.medium,
    backgroundColor: t.card,
    color: t.text,
    marginBottom: 12,
    textAlign: "right" as const,
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20, paddingTop: insets.top + 70, paddingBottom: insets.bottom + 30 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="رجوع"
          style={{ position: "absolute", top: insets.top + 12, right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}
        >
          <MaterialCommunityIcons name="arrow-right" size={22} color={t.text} />
        </Pressable>

        <Image
          source={t.isDark ? require("../assets/images/malaz/logo-dark.png") : require("../assets/images/malaz/logo-light.png")}
          style={{ width: 110, height: 44, alignSelf: "center", marginBottom: 18 }}
          contentFit="contain"
        />
        <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 24, textAlign: "center" }}>
          {tab === "login" ? "تسجيل الدخول" : "إنشاء حساب"}
        </Text>
        <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "center", marginTop: 6, marginBottom: 20 }}>
          حسابك بيحفظ بياناتك وعناوينك وكل حجوزاتك — على الموقع والتطبيق
        </Text>

        {/* Tabs */}
        <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 18 }}>
          {([["login", "دخول"], ["register", "حساب جديد"]] as const).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => { setTab(key); setError(""); }}
              style={{
                flex: 1, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1.5,
                borderColor: tab === key ? t.gold : t.border, backgroundColor: tab === key ? t.goldTint : t.card,
              }}
            >
              <Text style={{ fontSize: 14, fontFamily: TJ.heavy, color: tab === key ? t.gold : t.text }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {error ? (
          <Text style={{ color: t.destructive, fontSize: 13, fontFamily: TJ.bold, textAlign: "center", marginBottom: 10 }}>{error}</Text>
        ) : null}

        {tab === "login" ? (
          <>
            <TextInput style={inputStyle} placeholder="البريد الإلكتروني" placeholderTextColor={t.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={inputStyle} placeholder="كلمة المرور" placeholderTextColor={t.muted} value={pass} onChangeText={setPass} secureTextEntry />
            <GoldButton label={busy ? "جاري الدخول..." : "دخول"} onPress={handleLogin} disabled={busy} />
            <Pressable onPress={handleForgot} style={{ marginTop: 16 }}>
              <Text style={{ color: t.muted, fontSize: 13, textAlign: "center", fontFamily: TJ.medium }}>نسيت كلمة المرور؟</Text>
            </Pressable>
          </>
        ) : (
          <>
            <TextInput style={inputStyle} placeholder="الاسم الكامل" placeholderTextColor={t.muted} value={rName} onChangeText={setRName} />
            <TextInput style={inputStyle} placeholder="رقم الموبايل (01xxxxxxxxx)" placeholderTextColor={t.muted} value={rPhone} onChangeText={setRPhone} keyboardType="phone-pad" />
            <TextInput style={inputStyle} placeholder="البريد الإلكتروني" placeholderTextColor={t.muted} value={rEmail} onChangeText={setREmail} autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={inputStyle} placeholder="كلمة المرور (6 أحرف على الأقل)" placeholderTextColor={t.muted} value={rPass} onChangeText={setRPass} secureTextEntry />
            <GoldButton label={busy ? "جاري الإنشاء..." : "إنشاء حساب"} onPress={handleRegister} disabled={busy} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function GoldButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const t = useMalaz();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center",
        backgroundColor: t.gold, opacity: disabled ? 0.45 : pressed ? 0.9 : 1,
      })}
    >
      <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}
