import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PText, Select } from "@/components/provider/PUI";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { useProvider } from "@/contexts/ProviderContext";
import { digitsOnly } from "@/lib/digits";
import { supabase } from "@/lib/supabase";

const LOGO_LIGHT = require("../../assets/images/malaz/logo-light.png");
const LOGO_DARK = require("../../assets/images/malaz/logo-dark.png");

const SERVICE_TYPES = ["كشف منزلي", "تمريض منزلي", "أشعة منزلية"];
const DOCTOR_GRADES = ["أخصائي", "استشاري"];
const NURSE_GRADES = ["أخصائي تمريض", "فني تمريض"];
const FALLBACK_SPECIALTIES = ["باطنة", "أطفال", "قلب", "عظام", "جلدية", "نساء وتوليد", "أنف وأذن", "مخ وأعصاب", "سكر وغدد"];

type Mode = "login" | "register" | "forgot" | "forgotSent" | "pending";

export default function ProviderLoginScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { provider, login, register, resetPassword, signInWithGoogle, googleProfile, googleNotice, clearGoogle, completeGoogleRegistration } = useProvider();

  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [rName, setRName] = useState("");
  const [rEmail, setREmail] = useState("");
  const [rPass, setRPass] = useState("");
  const [rPhone, setRPhone] = useState("");
  const [rType, setRType] = useState("");
  const [rGrade, setRGrade] = useState("");
  const [rSpec, setRSpec] = useState("");
  const [specialties, setSpecialties] = useState<string[]>(FALLBACK_SPECIALTIES);

  useEffect(() => { if (provider) router.replace("/provider-portal/(ptabs)/overview"); }, [provider]);

  useEffect(() => {
    if (googleNotice === "pending") setMode("pending");
    if (googleNotice === "suspended") { setMode("login"); setError("تم إيقاف حسابك — تواصل مع الإدارة."); }
  }, [googleNotice]);

  useEffect(() => {
    if (googleProfile) { setMode("register"); setRName((n) => n || googleProfile.name); }
  }, [googleProfile]);

  useEffect(() => {
    supabase.from("sub_services").select("name").eq("service_name", "كشف منزلي").eq("group_name", "specialty")
      .then(({ data }) => { if (data && data.length) setSpecialties(data.map((d: any) => d.name)); }, () => {});
  }, []);

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const go = (m: Mode) => { setMode(m); setError(""); };

  const doLogin = async () => {
    if (!emailOk) { setError("اكتب بريدًا إلكترونيًا صحيحًا"); return; }
    if (pass.length < 6) { setError("كلمة المرور 6 أحرف على الأقل"); return; }
    setError(""); setBusy(true);
    try {
      await login(email.trim(), pass);
    } catch (e: any) {
      if (e.code === "pending") setMode("pending"); else setError(e.message ?? "حدث خطأ");
    } finally { setBusy(false); }
  };

  const doGoogle = async () => {
    setError(""); setBusy(true);
    try { await signInWithGoogle(); } catch (e: any) { setError(e.message ?? "تعذّر الدخول بجوجل"); } finally { setBusy(false); }
  };

  const doForgot = async () => {
    if (!emailOk) { setError("اكتب بريدًا إلكترونيًا صحيحًا"); return; }
    setError(""); setBusy(true);
    try { await resetPassword(email.trim()); setMode("forgotSent"); } catch (e: any) { setError(e.message ?? "حدث خطأ"); } finally { setBusy(false); }
  };

  const isDoctor = rType === "كشف منزلي";
  const isNurse = rType === "تمريض منزلي";
  const grades = isDoctor ? DOCTOR_GRADES : isNurse ? NURSE_GRADES : [];
  const phoneOk = rPhone.length === 11;
  const regOk =
    rName.trim().length > 1 && phoneOk && !!rType && (grades.length === 0 || !!rGrade) && (!isDoctor || !!rSpec) &&
    (googleProfile ? true : /^\S+@\S+\.\S+$/.test(rEmail.trim()) && rPass.length >= 6);

  const doRegister = async () => {
    if (!regOk) return;
    setError(""); setBusy(true);
    try {
      const base = { name: rName.trim(), phone: rPhone, serviceType: rType, grade: rGrade, specialty: rSpec };
      if (googleProfile) await completeGoogleRegistration(base);
      else {
        const msg = await register({ ...base, email: rEmail.trim(), password: rPass });
        // لو التأكيد بالإيميل مطلوب مبيتعملش صف providers لسه — نعرض الرسالة بس
        if (!msg.startsWith("✅ تم إنشاء الحساب — تحقق")) await supabase.auth.signOut();
      }
      setMode("pending");
    } catch (e: any) {
      setError(e.message?.includes("مسجّل") ? "هذا البريد مسجل بالفعل" : e.message ?? "حدث خطأ");
    } finally { setBusy(false); }
  };

  const input = {
    height: 48, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.card,
    color: t.text, paddingHorizontal: 14, fontSize: 15, fontFamily: TJ.medium, textAlign: "right" as const,
  };
  const ltr = { writingDirection: "ltr" as const };
  const label = (txt: string) => (
    <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "right", marginHorizontal: 4, marginBottom: 6 }}>{txt}</PText>
  );
  const gold = (txt: string, onPress: () => void, disabled?: boolean) => (
    <Pressable onPress={onPress} disabled={disabled}
      style={({ pressed }) => ({ borderRadius: 18, paddingVertical: 15, alignItems: "center", backgroundColor: t.gold, opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <PText style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 15.5 }}>{txt}</PText>
    </Pressable>
  );
  const link = (txt: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={{ paddingVertical: 6 }}>
      <PText style={{ color: t.gold, fontFamily: TJ.bold, fontSize: 14, textAlign: "center" }}>{txt}</PText>
    </Pressable>
  );
  const googleBtn = (txt: string) => (
    <Pressable onPress={doGoogle} disabled={busy}
      style={({ pressed }) => ({ height: 50, borderRadius: 16, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 10, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <MaterialCommunityIcons name="google" size={20} color={t.text} />
      <PText style={{ color: t.text, fontFamily: TJ.bold, fontSize: 15 }}>{txt}</PText>
    </Pressable>
  );
  const divider = (
    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, marginVertical: 4 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
      <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13 }}>أو</PText>
      <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
    </View>
  );
  const err = error ? <PText style={{ color: t.destructive, fontFamily: TJ.bold, fontSize: 13.5, textAlign: "right" }}>{error}</PText> : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={{ alignSelf: "flex-end", width: 40, height: 40, borderRadius: 20, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="chevron-right" size={24} color={t.gold} />
        </Pressable>
        <View style={{ alignItems: "center", marginTop: 6, marginBottom: 18 }}>
          <Image source={t.isDark ? LOGO_DARK : LOGO_LIGHT} style={{ height: 64, width: 190 }} contentFit="contain" />
          <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, marginTop: 6 }}>بوابة مقدم الخدمة</PText>
        </View>

        {mode === "login" ? (
          <View style={{ gap: 12 }}>
            <View>{label("البريد الإلكتروني")}<TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={[input, ltr]} /></View>
            <View>{label("كلمة المرور")}<TextInput value={pass} onChangeText={setPass} secureTextEntry style={input} /></View>
            <Pressable onPress={() => go("forgot")}><PText style={{ color: t.gold, fontFamily: TJ.bold, fontSize: 13.5, textAlign: "right" }}>نسيت كلمة المرور؟</PText></Pressable>
            {err}
            {gold(busy ? "جاري الدخول..." : "تسجيل الدخول", doLogin, busy)}
            {divider}
            {googleBtn("المتابعة بحساب جوجل")}
            {link("أول مرة معنا؟ إنشاء حساب جديد", () => go("register"))}
          </View>
        ) : null}

        {mode === "forgot" ? (
          <View style={{ gap: 12 }}>
            <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 20, textAlign: "right" }}>نسيت كلمة المرور؟</PText>
            <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "right", lineHeight: 21 }}>اكتب بريدك وسنرسل لك رابطًا لاسترجاع كلمة المرور.</PText>
            <View>{label("البريد الإلكتروني")}<TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={[input, ltr]} /></View>
            {err}
            {gold(busy ? "جاري الإرسال..." : "إرسال رابط الاسترجاع", doForgot, busy)}
            {link("العودة لتسجيل الدخول", () => go("login"))}
          </View>
        ) : null}

        {mode === "forgotSent" || mode === "pending" ? (
          <View style={{ alignItems: "center", gap: 14, paddingTop: 30 }}>
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: mode === "pending" ? t.goldTint : t.online, alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name={mode === "pending" ? "clock-outline" : "check"} size={44} color={mode === "pending" ? t.gold : "#fff"} />
            </View>
            <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 21, textAlign: "center" }}>
              {mode === "pending" ? "طلبك قيد المراجعة" : "تم إرسال الرابط"}
            </PText>
            <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14.5, textAlign: "center", lineHeight: 23, paddingHorizontal: 10 }}>
              {mode === "pending"
                ? "استلمنا بياناتك وستراجعها الإدارة.\nجهّز المستندات المطلوبة وأرسلها على واتساب 01039097982."
                : `أرسلنا رابط استرجاع كلمة المرور إلى ${email.trim()}`}
            </PText>
            {mode === "pending" ? (
              <Pressable
                onPress={() => Linking.openURL("https://wa.me/201039097982").catch(() => {})}
                style={({ pressed }) => ({ alignSelf: "stretch", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 16, backgroundColor: "rgba(37,211,102,.14)", transform: [{ scale: pressed ? 0.98 : 1 }] })}
              >
                <MaterialCommunityIcons name="whatsapp" size={20} color={t.whatsapp} />
                <PText style={{ color: t.whatsapp, fontFamily: TJ.heavy, fontSize: 15 }}>تواصل مع الإدارة</PText>
              </Pressable>
            ) : null}
            <View style={{ alignSelf: "stretch", marginTop: 8 }}>
              {gold("العودة لتسجيل الدخول", () => { clearGoogle().catch(() => {}); go("login"); })}
            </View>
          </View>
        ) : null}

        {mode === "register" ? (
          <View style={{ gap: 12 }}>
            <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 20, textAlign: "right" }}>حساب جديد</PText>
            <View>{label("الاسم الكامل")}<TextInput value={rName} onChangeText={setRName} style={input} /></View>
            {googleProfile ? (
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: t.card, borderWidth: 1, borderColor: t.border }}>
                <MaterialCommunityIcons name="google" size={22} color={t.gold} />
                <PText style={{ flex: 1, color: t.text, fontFamily: TJ.medium, fontSize: 14, textAlign: "right", writingDirection: "ltr" }}>{googleProfile.email}</PText>
                <Pressable onPress={() => { clearGoogle().catch(() => {}); }}><PText style={{ color: t.gold, fontFamily: TJ.bold, fontSize: 13.5 }}>تغيير</PText></Pressable>
              </View>
            ) : (
              <>
                <View>{label("البريد الإلكتروني")}<TextInput value={rEmail} onChangeText={setREmail} autoCapitalize="none" keyboardType="email-address" style={[input, ltr]} /></View>
                <View>{label("كلمة المرور (6 أحرف على الأقل)")}<TextInput value={rPass} onChangeText={setRPass} secureTextEntry style={input} /></View>
              </>
            )}
            <View>{label("رقم الموبايل (11 رقم)")}<TextInput value={rPhone} onChangeText={(v) => setRPhone(digitsOnly(v).slice(0, 11))} keyboardType="phone-pad" style={[input, ltr]} /></View>
            <Select label="نوع الخدمة" value={rType} options={SERVICE_TYPES} onChange={(v) => { setRType(v); setRGrade(""); setRSpec(""); }} />
            {grades.length ? <Select label="الدرجة" value={rGrade} options={grades} onChange={setRGrade} /> : null}
            {isDoctor ? <Select label="التخصص" value={rSpec} options={specialties} onChange={setRSpec} /> : null}
            {err}
            {gold(busy ? "جاري الإنشاء..." : "إنشاء الحساب", doRegister, busy || !regOk)}
            {!googleProfile ? (<>{divider}{googleBtn("التسجيل بحساب جوجل")}</>) : null}
            {link("لديك حساب؟ تسجيل الدخول", () => { clearGoogle().catch(() => {}); go("login"); })}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
