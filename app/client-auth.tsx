import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TJ, useMalaz } from "@/constants/malazTheme";
import { useApp } from "@/contexts/AppContext";
import { digitsOnly } from "@/lib/digits";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;
const TERMS_URL = "https://malaaz-plum.vercel.app/privacy.html";

type Step = "phone" | "otp" | "name" | "email";

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("expired") || m.includes("invalid")) return "الكود غير صحيح أو انتهت صلاحيته";
  if (m.includes("rate") || m.includes("seconds") || m.includes("too many")) return "حاولت أكتر من مرة، استنى شوية وجرّب تاني";
  return message;
}

export default function ClientAuthScreen() {
  const insets = useSafeAreaInsets();
  const t = useMalaz();
  const {
    clientLogin, clientRegister, clientResetPassword,
    clientSendOtp, clientVerifyOtp, clientCompleteSignup,
  } = useApp();

  const [step, setStep] = useState<Step>("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // phone / otp / name
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const codeInput = useRef<TextInput>(null);

  // email (existing accounts)
  const [emailTab, setEmailTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [rName, setRName] = useState("");
  const [rPhone, setRPhone] = useState("");
  const [rEmail, setREmail] = useState("");
  const [rPass, setRPass] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const go = (s: Step) => { setError(""); setStep(s); };

  const sendCode = async () => {
    setError(""); setBusy(true);
    try {
      await clientSendOtp(phone);
      setCode("");
      setCooldown(RESEND_SECONDS);
      setStep("otp");
      setTimeout(() => codeInput.current?.focus(), 250);
    } catch (e: any) {
      setError(friendly(e.message ?? "تعذّر إرسال الكود"));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError(""); setBusy(true);
    try {
      const { needsName } = await clientVerifyOtp(phone, code);
      if (needsName) setStep("name");
      else router.back();
    } catch (e: any) {
      setError(friendly(e.message ?? "حدث خطأ"));
    } finally {
      setBusy(false);
    }
  };

  const finishSignup = async () => {
    if (!name.trim()) { setError("اكتب اسمك"); return; }
    setError(""); setBusy(true);
    try {
      await clientCompleteSignup(name);
      router.back();
    } catch (e: any) {
      setError(e.message ?? "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !pass) { setError("أدخل البريد وكلمة المرور"); return; }
    setError(""); setBusy(true);
    try { await clientLogin(email.trim(), pass); router.back(); }
    catch (e: any) { setError(e.message ?? "حدث خطأ"); }
    finally { setBusy(false); }
  };

  const handleRegister = async () => {
    if (!rName.trim() || !rPhone.trim() || !rEmail.trim() || !rPass) { setError("املأ كل الحقول"); return; }
    if (!/^01[0125]\d{8}$/.test(rPhone.trim().replace(/\s/g, ""))) { setError("رقم الموبايل غير صحيح"); return; }
    if (rPass.length < 6) { setError("كلمة المرور 6 أحرف على الأقل"); return; }
    setError(""); setBusy(true);
    try {
      await clientRegister({ name: rName.trim(), phone: rPhone.trim().replace(/\s/g, ""), email: rEmail.trim(), password: rPass });
      Alert.alert("أهلاً بيك في ملاذ 🎉", "تم إنشاء حسابك بنجاح");
      router.back();
    } catch (e: any) { setError(e.message ?? "حدث خطأ"); }
    finally { setBusy(false); }
  };

  const handleForgot = async () => {
    if (!email.trim()) { setError("أدخل بريدك الإلكتروني أولاً"); return; }
    try {
      await clientResetPassword(email.trim());
      Alert.alert("تم", "✅ تم إرسال رابط إعادة تعيين كلمة المرور على بريدك");
    } catch (e: any) { Alert.alert("خطأ", e.message ?? "حدث خطأ"); }
  };

  const input = {
    height: 54, paddingHorizontal: 14, borderWidth: 1, borderColor: t.border, borderRadius: 16,
    fontSize: 14, fontFamily: TJ.medium, backgroundColor: t.card, color: t.text, marginBottom: 12, textAlign: "right" as const,
  };

  const Button = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => (
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

  const Title = ({ title, sub }: { title: string; sub: string }) => (
    <>
      <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 24, textAlign: "center" }}>{title}</Text>
      <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "center", marginTop: 6, marginBottom: 22, lineHeight: 22 }}>{sub}</Text>
    </>
  );

  const Err = () => (error ? <Text style={{ color: t.destructive, fontSize: 13, fontFamily: TJ.bold, textAlign: "center", marginBottom: 10 }}>{error}</Text> : null);

  const linkStyle = { color: t.muted, fontSize: 13, textAlign: "center" as const, fontFamily: TJ.medium };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20, paddingTop: insets.top + 70, paddingBottom: insets.bottom + 30 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => (step === "otp" ? go("phone") : step === "email" ? go("phone") : router.back())}
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

        {step === "phone" && (
          <>
            <Title title="تسجيل الدخول" sub="اكتب رقم موبايلك وهنبعتلك كود تحقق" />
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
            <Button label="إرسال الكود" onPress={sendCode} disabled={phone.length < 10} />
            <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12, textAlign: "center", marginTop: 14 }}>
              بالمتابعة أنت موافق على{" "}
              <Text onPress={() => Linking.openURL(TERMS_URL)} style={{ color: t.gold, textDecorationLine: "underline" }}>شروط الاستخدام</Text>
            </Text>
            <Pressable onPress={() => go("email")} style={{ marginTop: 26 }}>
              <Text style={[linkStyle, { textDecorationLine: "underline" }]}>الدخول بالبريد وكلمة المرور</Text>
            </Pressable>
          </>
        )}

        {step === "otp" && (
          <>
            <Title title="أدخل كود التحقق" sub={`بعتنالك كود من ${OTP_LENGTH} أرقام على \u2066+20 ${phone.replace(/^0+/, "")}\u2069`} />
            <Pressable onPress={() => codeInput.current?.focus()} style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 16 }}>
              {Array.from({ length: OTP_LENGTH }, (_, i) => {
                const active = i === Math.min(code.length, OTP_LENGTH - 1);
                return (
                  <View key={i} style={{ width: 48, height: 58, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: t.card, borderWidth: 1.5, borderColor: active ? t.gold : t.border }}>
                    <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 22 }}>{code[i] ?? ""}</Text>
                  </View>
                );
              })}
            </Pressable>
            <TextInput
              ref={codeInput}
              value={code}
              onChangeText={(v) => setCode(digitsOnly(v, OTP_LENGTH))}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              autoFocus
              caretHidden
              style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
            />
            <Err />
            <Button label="تأكيد" onPress={verify} disabled={code.length < OTP_LENGTH} />
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 18 }}>
              <Pressable onPress={() => go("phone")}><Text style={[linkStyle, { textDecorationLine: "underline" }]}>تغيير الرقم</Text></Pressable>
              <Pressable onPress={sendCode} disabled={cooldown > 0 || busy}>
                <Text style={[linkStyle, { color: cooldown > 0 ? t.muted : t.gold, textDecorationLine: cooldown > 0 ? "none" : "underline" }]}>
                  {cooldown > 0 ? `إعادة الإرسال بعد ${cooldown} ث` : "إعادة إرسال الكود"}
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {step === "name" && (
          <>
            <Title title="أهلاً بيك في ملاذ" sub="رقمك اتأكد. اكتب اسمك عشان نكمّل إنشاء حسابك" />
            <TextInput style={input} placeholder="الاسم الكامل" placeholderTextColor={t.muted} value={name} onChangeText={setName} autoFocus />
            <Err />
            <Button label="إنشاء الحساب" onPress={finishSignup} disabled={!name.trim()} />
          </>
        )}

        {step === "email" && (
          <>
            <Title title="الدخول بالبريد" sub="للحسابات اللي اتعملت بالبريد الإلكتروني وكلمة المرور" />
            <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 18 }}>
              {([["login", "دخول"], ["register", "حساب جديد"]] as const).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => { setEmailTab(key); setError(""); }}
                  style={{ flex: 1, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: emailTab === key ? t.gold : t.border, backgroundColor: emailTab === key ? t.goldTint : t.card }}
                >
                  <Text style={{ fontSize: 14, fontFamily: TJ.heavy, color: emailTab === key ? t.gold : t.text }}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Err />
            {emailTab === "login" ? (
              <>
                <TextInput style={input} placeholder="البريد الإلكتروني" placeholderTextColor={t.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                <TextInput style={input} placeholder="كلمة المرور" placeholderTextColor={t.muted} value={pass} onChangeText={setPass} secureTextEntry />
                <Button label="دخول" onPress={handleLogin} />
                <Pressable onPress={handleForgot} style={{ marginTop: 16 }}><Text style={linkStyle}>نسيت كلمة المرور؟</Text></Pressable>
              </>
            ) : (
              <>
                <TextInput style={input} placeholder="الاسم الكامل" placeholderTextColor={t.muted} value={rName} onChangeText={setRName} />
                <TextInput style={input} placeholder="رقم الموبايل (01xxxxxxxxx)" placeholderTextColor={t.muted} value={rPhone} onChangeText={(v) => setRPhone(digitsOnly(v, 11))} keyboardType="phone-pad" />
                <TextInput style={input} placeholder="البريد الإلكتروني" placeholderTextColor={t.muted} value={rEmail} onChangeText={setREmail} autoCapitalize="none" keyboardType="email-address" />
                <TextInput style={input} placeholder="كلمة المرور (6 أحرف على الأقل)" placeholderTextColor={t.muted} value={rPass} onChangeText={setRPass} secureTextEntry />
                <Button label="إنشاء حساب" onPress={handleRegister} />
              </>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
