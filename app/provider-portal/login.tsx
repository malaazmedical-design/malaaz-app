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

import { useProvider } from "@/contexts/ProviderContext";

const DARK = "#1C2B2A";
const GOLD = "#C9A84C";
const SERVICE_TYPES = ["كشف منزلي", "تمريض منزلي", "أشعة منزلية"];

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

export default function ProviderLoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, register, resetPassword } = useProvider();

  const [tab, setTab] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // login
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  // register
  const [rName, setRName] = useState("");
  const [rEmail, setREmail] = useState("");
  const [rPass, setRPass] = useState("");
  const [rPhone, setRPhone] = useState("");
  const [rServiceType, setRServiceType] = useState("");
  const [rSpecialty, setRSpecialty] = useState("");
  const [rAreas, setRAreas] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !pass) { setError("أدخل البريد وكلمة المرور"); return; }
    setError(""); setBusy(true);
    try {
      await login(email.trim(), pass);
      router.replace("/provider-portal/(ptabs)/overview");
    } catch (e: any) {
      setError(e.message ?? "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    if (!rName.trim() || !rEmail.trim() || !rPass || !rPhone.trim() || !rServiceType || !rSpecialty.trim() || !rAreas.trim()) {
      setError("يرجى ملء كل الحقول"); return;
    }
    if (rPass.length < 6) { setError("كلمة المرور 6 أحرف على الأقل"); return; }
    setError(""); setBusy(true);
    try {
      const msg = await register({
        name: rName.trim(),
        email: rEmail.trim(),
        password: rPass,
        phone: rPhone.trim(),
        serviceType: rServiceType,
        specialty: rSpecialty.trim(),
        areas: rAreas.trim(),
      });
      Alert.alert("تم", msg);
      setTab("login");
    } catch (e: any) {
      setError(e.message ?? "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    if (!email.trim()) { setError("أدخل بريدك الإلكتروني أولاً"); return; }
    try {
      await resetPassword(email.trim());
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
        {/* رجوع لتطبيق العملاء */}
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
            بوابة مقدم الخدمة — سجّل دخولك أو أنشئ حساب جديد
          </Text>

          {/* Tabs */}
          <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 20 }}>
            {([["login", "تسجيل الدخول"], ["register", "حساب جديد"]] as const).map(([key, label]) => (
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
              <TextInput style={inputStyle} placeholder="الاسم الكامل *" placeholderTextColor="rgba(255,255,255,0.3)" value={rName} onChangeText={setRName} />
              <TextInput style={inputStyle} placeholder="البريد الإلكتروني *" placeholderTextColor="rgba(255,255,255,0.3)" value={rEmail} onChangeText={setREmail} autoCapitalize="none" keyboardType="email-address" />
              <TextInput style={inputStyle} placeholder="كلمة المرور *" placeholderTextColor="rgba(255,255,255,0.3)" value={rPass} onChangeText={setRPass} secureTextEntry />
              <TextInput style={inputStyle} placeholder="رقم الموبايل *" placeholderTextColor="rgba(255,255,255,0.3)" value={rPhone} onChangeText={setRPhone} keyboardType="phone-pad" />

              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Cairo_600SemiBold", textAlign: "right", marginBottom: 8 }}>نوع الخدمة *</Text>
              <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 12 }}>
                {SERVICE_TYPES.map((st) => (
                  <Pressable
                    key={st}
                    onPress={() => setRServiceType(st)}
                    style={{
                      flex: 1, padding: 10, borderRadius: 10, alignItems: "center",
                      borderWidth: 1.5,
                      borderColor: rServiceType === st ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.1)",
                      backgroundColor: rServiceType === st ? "rgba(201,168,76,0.12)" : "transparent",
                    }}
                  >
                    <Text style={{ fontSize: 11, fontFamily: "Cairo_700Bold", color: rServiceType === st ? GOLD : "rgba(255,255,255,0.5)", textAlign: "center" }}>{st}</Text>
                  </Pressable>
                ))}
              </View>

              <TextInput style={inputStyle} placeholder="التخصص (مثال: باطنة، أطفال، تمريض) *" placeholderTextColor="rgba(255,255,255,0.3)" value={rSpecialty} onChangeText={setRSpecialty} />
              <TextInput style={inputStyle} placeholder="مناطق الخدمة (افصل بينها بفاصلة) *" placeholderTextColor="rgba(255,255,255,0.3)" value={rAreas} onChangeText={setRAreas} />

              <GoldButton label={busy ? "جاري الإنشاء..." : "إنشاء حساب"} icon="account-plus" onPress={handleRegister} disabled={busy} />
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 12, fontFamily: "Cairo_400Regular" }}>
                سيتم مراجعة طلبك من الأدمن قبل التفعيل
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
