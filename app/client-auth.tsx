import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { Text, TextInput } from "@/components/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TJ, useMalaz } from "@/constants/malazTheme";
import { useApp } from "@/contexts/AppContext";
import { digitsOnly } from "@/lib/digits";
import { supabase } from "@/lib/supabase";


export default function ClientAuthScreen() {
  const insets = useSafeAreaInsets();
  const t = useMalaz();
  const {
    client, needsPhone, profile,
    clientLogin, clientRegister, clientResetPassword, clientSignInWithGoogle, clientCompleteProfile, clientLogout,
  } = useApp();

  const [tab, setTab] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [rName, setRName] = useState("");
  const [rPhone, setRPhone] = useState("");
  const [rEmail, setREmail] = useState("");
  const [rPass, setRPass] = useState("");

  // phone step (shown after any sign-in that has no mobile number yet)
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");

  // signed in successfully (and has a client record) -> leave the screen
  useEffect(() => {
    if (client) router.back();
  }, [client]);

  // pre-fill the name from the account (Google gives the full name)
  useEffect(() => {
    if (!needsPhone) return;
    supabase.auth.getUser().then(({ data }) => {
      const meta: any = data.user?.user_metadata ?? {};
      setName((cur) => cur || meta.full_name || meta.name || profile.name || "");
    }).catch(() => {});
  }, [needsPhone, profile.name]);

  const run = async (fn: () => Promise<void>) => {
    setError(""); setBusy(true);
    try { await fn(); }
    catch (e: any) { setError(e?.message ?? "حدث خطأ"); }
    finally { setBusy(false); }
  };

  const handleLogin = () => {
    if (!email.trim() || !pass) { setError("أدخل البريد وكلمة المرور"); return; }
    run(async () => { await clientLogin(email.trim(), pass); });
  };

  const handleRegister = () => {
    if (!rName.trim() || !rPhone.trim() || !rEmail.trim() || !rPass) { setError("املأ كل الحقول"); return; }
    if (!/^01[0125]\d{8}$/.test(rPhone.trim())) { setError("رقم الموبايل غير صحيح"); return; }
    if (rPass.length < 6) { setError("كلمة المرور 6 أحرف على الأقل"); return; }
    run(async () => {
      await clientRegister({ name: rName.trim(), phone: rPhone.trim(), email: rEmail.trim(), password: rPass });
      Alert.alert("أهلاً بيك في ملاذ 🎉", "تم إنشاء حسابك بنجاح");
    });
  };

  const handleForgot = async () => {
    if (!email.trim()) { setError("أدخل بريدك الإلكتروني أولاً"); return; }
    try {
      await clientResetPassword(email.trim());
      Alert.alert("تم", "✅ تم إرسال رابط إعادة تعيين كلمة المرور على بريدك");
    } catch (e: any) { Alert.alert("خطأ", e.message ?? "حدث خطأ"); }
  };

  const savePhone = () => {
    if (phone.length < 10) { setError("اكتب رقم موبايل صحيح"); return; }
    run(async () => { await clientCompleteProfile(phone, name.trim() || undefined); });
  };

  const input = {
    height: 54, paddingHorizontal: 14, borderWidth: 1, borderColor: t.border, borderRadius: 16,
    fontSize: 14, fontFamily: TJ.medium, backgroundColor: t.card, color: t.text, marginBottom: 12, textAlign: "right" as const,
  };
  const linkStyle = { color: t.muted, fontSize: 13, textAlign: "center" as const, fontFamily: TJ.medium };

  const GoldButton = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => ({
        height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: t.gold,
        opacity: disabled || busy ? 0.45 : pressed ? 0.9 : 1,
      })}
    >
      <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 16 }}>{busy ? "..." : label}</Text>
    </Pressable>
  );

  const Heading = ({ title, sub }: { title: string; sub: string }) => (
    <>
      <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 24, textAlign: "center" }}>{title}</Text>
      <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "center", marginTop: 6, marginBottom: 22, lineHeight: 22 }}>{sub}</Text>
    </>
  );

  const Err = () => (error ? <Text style={{ color: t.destructive, fontSize: 13, fontFamily: TJ.bold, textAlign: "center", lineHeight: 21, marginBottom: 10 }}>{error}</Text> : null);

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

        {needsPhone ? (
          <>
            <Heading title="أضف رقم موبايلك" sub="الرقم ده هو اللي هيتواصل بيه معاك مقدم الخدمة. ولو عندك حساب قديم بنفس الرقم هنفتحه لك بدل ما نعمل حساب جديد." />
            <TextInput style={input} placeholder="الاسم" placeholderTextColor={t.muted} value={name} onChangeText={setName} />
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
              <View style={{ height: 54, paddingHorizontal: 14, borderRadius: 16, backgroundColor: t.ic, borderWidth: 1, borderColor: t.border, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15 }}>+20</Text>
              </View>
              <TextInput
                value={phone}
                onChangeText={(v) => setPhone(digitsOnly(v, 11))}
                placeholder="01X XXXX XXXX"
                placeholderTextColor={t.muted}
                keyboardType="number-pad"
                autoComplete="tel"
                style={[input, { flex: 1, marginBottom: 0, textAlign: "left", writingDirection: "ltr", fontSize: 17, letterSpacing: 1 }]}
              />
            </View>
            <Err />
            <GoldButton label="حفظ ومتابعة" onPress={savePhone} disabled={phone.length < 10} />
            <Pressable onPress={() => clientLogout()} style={{ marginTop: 22 }}>
              <Text style={[linkStyle, { textDecorationLine: "underline" }]}>تسجيل الخروج</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Heading title={tab === "login" ? "تسجيل الدخول" : "إنشاء حساب"} sub="حسابك بيحفظ بياناتك وعناوينك وكل حجوزاتك — على الموقع والتطبيق" />

            <Pressable
              onPress={() => run(clientSignInWithGoogle)}
              disabled={busy}
              style={({ pressed }) => ({
                height: 54, borderRadius: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 10,
                backgroundColor: t.card, borderWidth: 1.5, borderColor: t.border, opacity: busy ? 0.6 : pressed ? 0.9 : 1,
              })}
            >
              <MaterialCommunityIcons name="google" size={22} color="#DB4437" />
              <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15.5 }}>المتابعة بحساب جوجل</Text>
            </Pressable>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 18 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
              <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5 }}>أو بالبريد الإلكتروني</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
            </View>

            <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 16 }}>
              {([["login", "دخول"], ["register", "حساب جديد"]] as const).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => { setTab(key); setError(""); }}
                  style={{ flex: 1, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: tab === key ? t.gold : t.border, backgroundColor: tab === key ? t.goldTint : t.card }}
                >
                  <Text style={{ fontSize: 14, fontFamily: TJ.heavy, color: tab === key ? t.gold : t.text }}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <Err />
            {tab === "login" ? (
              <>
                <TextInput style={input} placeholder="البريد الإلكتروني" placeholderTextColor={t.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                <TextInput style={input} placeholder="كلمة المرور" placeholderTextColor={t.muted} value={pass} onChangeText={setPass} secureTextEntry />
                <GoldButton label="دخول" onPress={handleLogin} />
                <Pressable onPress={handleForgot} style={{ marginTop: 16 }}><Text style={linkStyle}>نسيت كلمة المرور؟</Text></Pressable>
              </>
            ) : (
              <>
                <TextInput style={input} placeholder="الاسم الكامل" placeholderTextColor={t.muted} value={rName} onChangeText={setRName} />
                <TextInput style={input} placeholder="رقم الموبايل (01xxxxxxxxx)" placeholderTextColor={t.muted} value={rPhone} onChangeText={(v) => setRPhone(digitsOnly(v, 11))} keyboardType="number-pad" />
                <TextInput style={input} placeholder="البريد الإلكتروني" placeholderTextColor={t.muted} value={rEmail} onChangeText={setREmail} autoCapitalize="none" keyboardType="email-address" />
                <TextInput style={input} placeholder="كلمة المرور (6 أحرف على الأقل)" placeholderTextColor={t.muted} value={rPass} onChangeText={setRPass} secureTextEntry />
                <GoldButton label="إنشاء حساب" onPress={handleRegister} />
              </>
            )}
            <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12, textAlign: "center", marginTop: 18 }}>
              بالمتابعة أنت موافق على{" "}
              <Text onPress={() => router.push("/legal?open=terms")} style={{ color: t.goldText, textDecorationLine: "underline" }}>الشروط والأحكام</Text>
              {" و"}
              <Text onPress={() => router.push("/legal?open=privacy")} style={{ color: t.goldText, textDecorationLine: "underline" }}>سياسة الخصوصية</Text>
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
