import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, Text, TextInput, View, ActivityIndicator,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/ui";
import {
  SERVICE_CATEGORIES, ServiceType, serviceTypeToArabic,
  PAYMENT_METHODS, PaymentMethod, TIME_PERIODS,
} from "@/constants/data";
import { serviceIcon } from "@/constants/icons";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { DbSubService } from "@/lib/supabase";

type Step = 1 | 2 | 3 | 4;
type Grade = "أخصائي" | "استشاري";

// نطاق سعر الخدمة الفرعية حسب الدرجة (زي الموقع بالظبط)
function priceRange(sub: DbSubService, grade: Grade): { min: number; max: number } {
  const consultant = grade === "استشاري";
  return {
    min: (consultant ? sub.price_min_consultant : sub.price_min_specialist) ?? sub.price_min ?? 0,
    max: (consultant ? sub.price_max_consultant : sub.price_max_specialist) ?? sub.price_max ?? 0,
  };
}

export default function QuickRequestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, createBooking, subServices, coverageAreas, client, familyMembers, addresses } = useApp();

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  // Step 1 — الخدمة والدرجة والتخصص
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [grade, setGrade] = useState<Grade>("أخصائي");
  const [selectedSub, setSelectedSub] = useState<DbSubService | null>(null);
  const [subSearch, setSubSearch] = useState("");

  // Step 2 — بيانات المريض والموعد والمكان
  const [forMemberId, setForMemberId] = useState<string | null>(null); // null = أنا شخصياً
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email ?? "");
  const [area, setArea] = useState(profile.area);
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  const [address, setAddress] = useState(profile.address);

  // لو البروفايل اتحمّل بعد mount (async من Supabase) — نملّي الحقول الفاضية فقط
  React.useEffect(() => {
    setName((prev) => prev || profile.name);
    setPhone((prev) => prev || profile.phone);
    setEmail((prev) => prev || profile.email || "");
    setArea((prev) => prev || profile.area);
    setAddress((prev) => prev || profile.address);
  }, [profile.name, profile.phone, profile.email, profile.area, profile.address]);

  // لو في عنوان افتراضي محفوظ — نملّيه تلقائياً
  React.useEffect(() => {
    if (!addresses.length) return;
    const def = addresses.find((a) => a.is_default) ?? addresses[0];
    setAddress((prev) => prev || def.address);
    setArea((prev) => prev || def.area || "");
  }, [addresses]);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<string>(TIME_PERIODS[0]);
  const [notes, setNotes] = useState("");

  // Step 3 — دفع
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

  const arabicService = selectedService ? serviceTypeToArabic(selectedService) : null;
  const isDoctor = selectedService === "doctor";

  // الخدمات الفرعية من قاعدة البيانات — نفس مصدر الموقع
  const dbSubs = useMemo(() => {
    if (!arabicService) return [];
    return subServices.filter(
      (s) =>
        s.service_name === arabicService &&
        s.group_name !== "grade" &&
        (!isDoctor || s.group_name === "specialty")
    );
  }, [subServices, arabicService, isDoctor]);

  // نطاق سعر الدرجة كلها (للكروت أخصائي/استشاري)
  const gradeRange = (g: Grade) => {
    const ranges = dbSubs.map((s) => priceRange(s, g)).filter((r) => r.max > 0);
    if (!ranges.length) return null;
    return {
      min: Math.min(...ranges.map((r) => r.min)),
      max: Math.max(...ranges.map((r) => r.max)),
    };
  };

  const STEP_TITLES: Record<Step, string> = {
    1: "نوع الخدمة",
    2: "بيانات الحجز",
    3: "طريقة الدفع",
    4: "تأكيد الطلب",
  };

  // ─── GPS Location ─────────────────────────────────────────────────────────
  const handleGetLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("تنبيه", "يرجى السماح بالوصول للموقع من إعدادات الهاتف");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [geo] = await Location.reverseGeocodeAsync(loc.coords);
      const label = [geo.street, geo.district, geo.city].filter(Boolean).join("، ");
      setLocationLabel(label);
      if (label) setAddress(label);
      // مطابقة المنطقة مع مناطق التغطية من قاعدة البيانات
      if (geo.district) {
        const match = coverageAreas.find(
          (a) => geo.district!.includes(a.name) || a.name.includes(geo.district!)
        );
        if (match) setArea(match.name);
      }
    } catch {
      Alert.alert("خطأ", "تعذّر تحديد الموقع، يرجى إدخاله يدوياً");
    } finally {
      setLocating(false);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!selectedService) { Alert.alert("تنبيه", "اختار الخدمة أولاً"); return; }
      if (!selectedSub)     { Alert.alert("تنبيه", isDoctor ? "اختار التخصص المطلوب" : "اختار نوع الخدمة"); return; }
    }
    if (step === 2) {
      if (!name.trim())    { Alert.alert("تنبيه", "يرجى إدخال اسم المريض"); return; }
      if (!phone.trim())   { Alert.alert("تنبيه", "يرجى إدخال رقم الموبايل"); return; }
      if (!area)           { Alert.alert("تنبيه", "يرجى اختيار المنطقة"); return; }
      if (!address.trim()) { Alert.alert("تنبيه", "يرجى كتابة العنوان التفصيلي أو تحديد موقعك"); return; }
    }
    if (step === 3) {
      if (!paymentMethod) { Alert.alert("تنبيه", "اختار طريقة الدفع"); return; }
    }
    setStep((s) => (s + 1) as Step);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // لو الحجز لفرد عائلة — اسم صاحب الحساب يفضل زي ما هو في البروفايل
      const bookingForFamily = forMemberId !== null;
      await updateProfile({
        ...(bookingForFamily ? {} : { name: name.trim() }),
        phone: phone.trim(),
        email: email.trim() || undefined,
        area,
        address: address.trim(),
      });
      await createBooking({
        serviceType: selectedService!,
        serviceName: isDoctor ? `${grade} ${selectedSub!.name}` : selectedSub!.name,
        paymentMethod: paymentMethod!,
        scheduledTime: timePeriod,
        notes: notes.trim() || undefined,
        patientName: name.trim(),
        patientPhone: phone.trim(),
        patientEmail: email.trim() || undefined,
        patientAddress: address.trim() || undefined,
        patientArea: area || undefined,
      });
      router.replace("/booking-success");
    } catch (err: any) {
      Alert.alert("خطأ", err.message ?? "حدث خطأ، يرجى المحاولة مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedRange = selectedSub ? priceRange(selectedSub, grade) : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ─── Header ─── */}
      <View style={{ backgroundColor: "#1C2B2A", paddingTop: insets.top + 12, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => (step === 1 ? router.back() : setStep((s) => (s - 1) as Step))}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#FFFFFF15", alignItems: "center", justifyContent: "center" }}
          >
            <MaterialCommunityIcons name="chevron-right" size={24} color="#C9A84C" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#C9A84C", fontFamily: "Cairo_700Bold", fontSize: 18, textAlign: "right" }}>
              احجز موعدك
            </Text>
            <Text style={{ color: "#FFFFFF66", fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right" }}>
              {STEP_TITLES[step]} — الخطوة {step} من 4
            </Text>
          </View>
        </View>
        {/* Progress Bar */}
        <View style={{ flexDirection: "row-reverse", gap: 6, marginTop: 16 }}>
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: s <= step ? "#C9A84C" : "#FFFFFF22" }} />
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ══════════════════════════════════════════════════════
            STEP 1 — الخدمة → الدرجة → التخصص (زي الموقع)
        ══════════════════════════════════════════════════════ */}
        {step === 1 && (
          <View style={{ gap: 20 }}>
            <View>
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 20, textAlign: "right", marginBottom: 14 }}>
                اختر الخدمة
              </Text>
              <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                {SERVICE_CATEGORIES.map((cat) => {
                  const isActive = selectedService === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => { setSelectedService(cat.id as ServiceType); setSelectedSub(null); setSubSearch(""); }}
                      style={({ pressed }) => ({
                        flex: 1, alignItems: "center", padding: 12, borderRadius: 16, borderWidth: 2,
                        backgroundColor: isActive ? "#1C2B2A" : colors.card,
                        borderColor: isActive ? "#C9A84C" : colors.border,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      })}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: isActive ? "#C9A84C22" : colors.muted, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                        <MaterialCommunityIcons name={cat.icon as any} size={24} color={isActive ? "#C9A84C" : colors.foreground} />
                      </View>
                      <Text style={{ color: isActive ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 12, textAlign: "center" }}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* الدرجة العلمية — للكشف المنزلي فقط (زي الموقع) */}
            {isDoctor && (
              <View>
                <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", marginBottom: 12 }}>
                  الدرجة العلمية
                </Text>
                <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                  {(["أخصائي", "استشاري"] as Grade[]).map((g) => {
                    const isActive = grade === g;
                    const range = gradeRange(g);
                    return (
                      <Pressable
                        key={g}
                        onPress={() => setGrade(g)}
                        style={{ flex: 1, alignItems: "center", padding: 14, borderRadius: 16, borderWidth: 2, backgroundColor: isActive ? "#1C2B2A" : colors.card, borderColor: isActive ? "#C9A84C" : colors.border }}
                      >
                        <MaterialCommunityIcons name={g === "استشاري" ? "medal" : "stethoscope"} size={22} color={isActive ? "#C9A84C" : colors.foreground} />
                        <Text style={{ color: isActive ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 14, marginTop: 6 }}>{g}</Text>
                        {range ? (
                          <Text style={{ color: isActive ? "#FFFFFF88" : colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 11, marginTop: 2 }}>
                            {range.min}–{range.max} ج.م
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* التخصص / النوع — قائمة أنيقة بأيقونات مميزة (ستايل فيزيتا بهوية ملاذ) */}
            {selectedService && (
              <View>
                <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", marginBottom: 12 }}>
                  {isDoctor ? "اختر التخصص" : "اختر نوع الخدمة"}
                </Text>

                {/* بحث في التخصصات */}
                {dbSubs.length > 5 ? (
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14, height: 48, borderWidth: 1.5, borderColor: colors.border, marginBottom: 12 }}>
                    <MaterialCommunityIcons name="magnify" size={20} color={colors.mutedForeground} />
                    <TextInput
                      value={subSearch}
                      onChangeText={setSubSearch}
                      placeholder={isDoctor ? "ابحث في التخصصات..." : "ابحث في الخدمات..."}
                      placeholderTextColor={colors.mutedForeground}
                      style={{ flex: 1, fontFamily: "Cairo_400Regular", fontSize: 13, color: colors.foreground, textAlign: "right" }}
                    />
                    {subSearch.length > 0 ? (
                      <Pressable onPress={() => setSubSearch("")}>
                        <MaterialCommunityIcons name="close-circle" size={17} color={colors.mutedForeground} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {dbSubs.length === 0 ? (
                  <View style={{ alignItems: "center", padding: 24 }}>
                    <ActivityIndicator color="#C9A84C" />
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 12, marginTop: 8 }}>جاري تحميل الخدمات...</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
                    {dbSubs
                      .filter((s) => !subSearch.trim() || s.name.includes(subSearch.trim()))
                      .map((sub, subIndex, arr) => {
                        const isActive = selectedSub?.id === sub.id;
                        const range = priceRange(sub, grade);
                        return (
                          <Animated.View key={sub.id} entering={FadeInUp.delay(Math.min(subIndex, 10) * 50).springify()}>
                            <Pressable
                              onPress={() => {
                                setSelectedSub(sub);
                                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }}
                              style={({ pressed }) => ({
                                flexDirection: "row-reverse", alignItems: "center", gap: 14,
                                paddingVertical: 14, paddingHorizontal: 16,
                                backgroundColor: isActive ? "#1C2B2A" : pressed ? colors.surfaceMuted : "transparent",
                                borderBottomWidth: subIndex < arr.length - 1 ? 1 : 0,
                                borderBottomColor: colors.border,
                              })}
                            >
                              {/* أيقونة التخصص بهوية ملاذ */}
                              <View style={{
                                width: 50, height: 50, borderRadius: 25,
                                backgroundColor: isActive ? "#C9A84C" : "rgba(201,168,76,0.10)",
                                borderWidth: 1.5, borderColor: isActive ? "#C9A84C" : "rgba(201,168,76,0.35)",
                                alignItems: "center", justifyContent: "center",
                              }}>
                                <MaterialCommunityIcons
                                  name={serviceIcon(sub.name) as any}
                                  size={26}
                                  color={isActive ? "#1C2B2A" : "#b8860b"}
                                />
                              </View>

                              <View style={{ flex: 1 }}>
                                <Text style={{ color: isActive ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 15, textAlign: "right" }}>
                                  {sub.name}
                                </Text>
                                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, marginTop: 3 }}>
                                  {range.max > 0 ? (
                                    <Text style={{ color: isActive ? "#C9A84C" : "#b8860b", fontFamily: "Cairo_700Bold", fontSize: 12 }}>
                                      {range.min}–{range.max} ج.م
                                    </Text>
                                  ) : null}
                                  {sub.duration ? (
                                    <Text style={{ color: isActive ? "#FFFFFF88" : colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 11 }}>
                                      ⏱ {sub.duration}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>

                              {isActive ? (
                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#C9A84C", alignItems: "center", justifyContent: "center" }}>
                                  <MaterialCommunityIcons name="check" size={15} color="#1C2B2A" />
                                </View>
                              ) : (
                                <MaterialCommunityIcons name="chevron-left" size={20} color={colors.mutedForeground} />
                              )}
                            </Pressable>
                          </Animated.View>
                        );
                      })}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 2 — بيانات الحجز (زي الموقع)
        ══════════════════════════════════════════════════════ */}
        {step === 2 && (
          <View style={{ gap: 16 }}>
            {/* ملخص الخدمة المختارة */}
            <View style={{ backgroundColor: "#C9A84C14", borderWidth: 1, borderColor: "#C9A84C44", borderRadius: 12, padding: 12 }}>
              <Text style={{ color: "#b8860b", fontFamily: "Cairo_600SemiBold", fontSize: 13, textAlign: "right" }}>
                ⚕️ {arabicService} — {isDoctor ? `${grade} ` : ""}{selectedSub?.name}
                {selectedRange && selectedRange.max > 0 ? `  (${selectedRange.min}–${selectedRange.max} ج.م)` : ""}
              </Text>
            </View>

            {/* الحجز لـ — أفراد العائلة (للعميل المسجّل) */}
            {client && familyMembers.length > 0 ? (
              <View>
                <Text style={{ color: colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 14, textAlign: "right", marginBottom: 8 }}>الحجز لـ</Text>
                <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
                  <Pressable
                    onPress={() => { setForMemberId(null); setName(profile.name); }}
                    style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, backgroundColor: forMemberId === null ? "#1C2B2A" : colors.card, borderColor: forMemberId === null ? "#C9A84C" : colors.border }}
                  >
                    <Text style={{ fontSize: 12, fontFamily: "Cairo_600SemiBold", color: forMemberId === null ? "#C9A84C" : colors.foreground }}>👤 أنا شخصياً</Text>
                  </Pressable>
                  {familyMembers.map((m) => (
                    <Pressable
                      key={m.id}
                      onPress={() => { setForMemberId(m.id); setName(m.name); }}
                      style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, backgroundColor: forMemberId === m.id ? "#1C2B2A" : colors.card, borderColor: forMemberId === m.id ? "#C9A84C" : colors.border }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: "Cairo_600SemiBold", color: forMemberId === m.id ? "#C9A84C" : colors.foreground }}>
                        {m.name}{m.relation ? ` (${m.relation})` : ""}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right" }}>بيانات المريض</Text>
            <Field label="اسم المريض" icon="account" value={name} onChange={setName} placeholder="مثال: محمد أحمد" />
            <Field label="رقم الموبايل" icon="phone" value={phone} onChange={setPhone} placeholder="01xxxxxxxxx" keyboardType="phone-pad" />
            <Field label="البريد الإلكتروني" icon="email" value={email} onChange={setEmail} placeholder="للإشعارات (اختياري)" keyboardType="email-address" optional />

            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", marginTop: 4 }}>الموعد والمكان</Text>

            {/* المنطقة — من مناطق التغطية في قاعدة البيانات */}
            <View>
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 14, textAlign: "right", marginBottom: 8 }}>المنطقة</Text>
              <Pressable
                onPress={() => setAreaPickerOpen(true)}
                style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14, height: 54, borderWidth: 1.5, borderColor: colors.border }}
              >
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                  <MaterialCommunityIcons name="map-marker" size={20} color={area ? "#b8860b" : colors.mutedForeground} />
                  <Text style={{ fontFamily: "Cairo_600SemiBold", fontSize: 14, color: area ? colors.foreground : colors.mutedForeground }}>
                    {area || "اختر منطقتك"}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-down" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* العنوان + GPS */}
            <View>
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 14, textAlign: "right", marginBottom: 8 }}>العنوان التفصيلي</Text>

              {/* العناوين المحفوظة للعميل المسجّل */}
              {client && addresses.length > 0 ? (
                <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  {addresses.map((a) => {
                    const active = address === a.address;
                    return (
                      <Pressable
                        key={a.id}
                        onPress={() => { setAddress(a.address); if (a.area) setArea(a.area); }}
                        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, backgroundColor: active ? "#1C2B2A" : colors.card, borderColor: active ? "#C9A84C" : colors.border, maxWidth: "100%" }}
                      >
                        <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: "Cairo_600SemiBold", color: active ? "#C9A84C" : colors.foreground }}>
                          {a.is_default ? "⭐ " : "📍 "}{a.address}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <Pressable
                onPress={handleGetLocation}
                style={({ pressed }) => ({
                  flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8,
                  backgroundColor: "#1C2B2A", padding: 14, borderRadius: 14, marginBottom: 10,
                  borderWidth: 1.5, borderColor: "#C9A84C",
                  opacity: locating ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                {locating
                  ? <ActivityIndicator size="small" color="#C9A84C" />
                  : <MaterialCommunityIcons name="map-marker-radius" size={20} color="#C9A84C" />
                }
                <Text style={{ color: "#C9A84C", fontFamily: "Cairo_600SemiBold", fontSize: 14 }}>
                  {locating ? "جاري تحديد موقعك..." : "تحديد موقعي تلقائياً 📍"}
                </Text>
              </Pressable>

              {locationLabel ? (
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: "#16A34A15", padding: 10, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: "#16A34A33" }}>
                  <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                  <Text style={{ color: "#16A34A", fontFamily: "Cairo_500Medium", fontSize: 12, flex: 1, textAlign: "right" }}>
                    {locationLabel}
                  </Text>
                </View>
              ) : null}

              <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10, backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: colors.border, minHeight: 90 }}>
                <MaterialCommunityIcons name="home" size={20} color={colors.mutedForeground} style={{ marginTop: 2 }} />
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="الشارع، العمارة، الدور، الشقة..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  style={{ flex: 1, fontFamily: "Cairo_400Regular", fontSize: 14, color: colors.foreground, textAlign: "right" }}
                />
              </View>
            </View>

            {/* الفترة */}
            <View>
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 14, textAlign: "right", marginBottom: 8 }}>الفترة المفضلة</Text>
              <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
                {TIME_PERIODS.map((t) => (
                  <Pressable key={t} onPress={() => setTimePeriod(t)}
                    style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, backgroundColor: timePeriod === t ? "#1C2B2A" : colors.card, borderColor: timePeriod === t ? "#C9A84C" : colors.border }}>
                    <Text style={{ color: timePeriod === t ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 13 }}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Notes */}
            <Field label="ملاحظات إضافية" icon="note-text" value={notes} onChange={setNotes} placeholder="أي تفاصيل مهمة..." multiline optional />
          </View>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 3 — طريقة الدفع
        ══════════════════════════════════════════════════════ */}
        {step === 3 && (
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 20, textAlign: "right", marginBottom: 8 }}>
              طريقة الدفع
            </Text>
            {PAYMENT_METHODS.map((pm) => {
              const isActive = paymentMethod === pm.id;
              return (
                <Pressable
                  key={pm.id}
                  onPress={() => setPaymentMethod(pm.id)}
                  style={({ pressed }) => ({
                    flexDirection: "row-reverse", alignItems: "center", gap: 16, padding: 18,
                    borderRadius: 18, borderWidth: 2,
                    backgroundColor: isActive ? "#1C2B2A" : colors.card,
                    borderColor: isActive ? "#C9A84C" : colors.border,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: isActive ? "#C9A84C22" : colors.muted, alignItems: "center", justifyContent: "center" }}>
                    <MaterialCommunityIcons name={pm.icon as any} size={28} color={isActive ? "#C9A84C" : colors.foreground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: isActive ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right" }}>
                      {pm.name}
                    </Text>
                    <Text style={{ color: isActive ? "#FFFFFF88" : colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "right", marginTop: 2 }}>
                      {pm.description}{pm.detail ? ` ${pm.detail}` : ""}
                    </Text>
                  </View>
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: isActive ? "#C9A84C" : colors.border, backgroundColor: isActive ? "#C9A84C" : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {isActive ? <MaterialCommunityIcons name="check" size={14} color="#1C2B2A" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 4 — مراجعة وتأكيد
        ══════════════════════════════════════════════════════ */}
        {step === 4 && (
          <View style={{ gap: 16 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 20, textAlign: "right", marginBottom: 4 }}>
              راجع طلبك
            </Text>
            <View style={{ backgroundColor: "#1C2B2A", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#C9A84C44", gap: 12 }}>
              <Text style={{ color: "#C9A84C", fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", marginBottom: 4 }}>ملخص الطلب</Text>
              <SummaryRow icon="medical-bag"   label="الخدمة"  value={`${arabicService} — ${isDoctor ? `${grade} ` : ""}${selectedSub?.name}`} />
              <SummaryRow icon="account"       label="الاسم"   value={name} />
              <SummaryRow icon="phone"         label="الهاتف"  value={phone} />
              <SummaryRow icon="map-marker"    label="المنطقة" value={area} />
              <SummaryRow icon="home"          label="العنوان" value={address} />
              <SummaryRow icon="clock-outline" label="الموعد"  value={timePeriod} />
              <SummaryRow icon="cash"          label="الدفع"   value={PAYMENT_METHODS.find((p) => p.id === paymentMethod)?.name ?? ""} />
              {notes ? <SummaryRow icon="note-text" label="ملاحظات" value={notes} /> : null}
            </View>
            <View style={{ backgroundColor: "#C9A84C15", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#C9A84C33", flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
              <MaterialCommunityIcons name="information" size={18} color="#C9A84C" style={{ marginTop: 2 }} />
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "right", flex: 1, lineHeight: 22 }}>
                سيتواصل معك فريق ملاذ خلال 15 دقيقة لتأكيد الموعد وتعيين أفضل مقدم خدمة في منطقتك.
              </Text>
            </View>
          </View>
        )}

      </ScrollView>

      {/* ─── اختيار المنطقة ─── */}
      <Modal visible={areaPickerOpen} transparent animationType="slide" onRequestClose={() => setAreaPickerOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={() => setAreaPickerOpen(false)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%" }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 16, color: colors.foreground, textAlign: "right" }}>اختر منطقتك</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
              {coverageAreas.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => { setArea(a.name); setAreaPickerOpen(false); }}
                  style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 12, backgroundColor: area === a.name ? "#C9A84C18" : "transparent" }}
                >
                  <Text style={{ fontFamily: "Cairo_600SemiBold", fontSize: 14, color: area === a.name ? "#b8860b" : colors.foreground }}>{a.name}</Text>
                  <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 12, color: colors.mutedForeground }}>{a.city}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Footer Button ─── */}
      <View style={{ padding: 20, paddingBottom: insets.bottom + 16, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
        {step < 4 ? (
          <PrimaryButton label="التالي" icon="arrow-left" onPress={handleNext} />
        ) : (
          <PrimaryButton
            label={submitting ? "جاري الإرسال..." : "تأكيد الحجز"}
            icon={submitting ? undefined : "check"}
            loading={submitting}
            onPress={handleSubmit}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, icon, value, onChange, placeholder, keyboardType, multiline, optional }: {
  label: string; icon: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; multiline?: boolean; optional?: boolean;
}) {
  const colors = useColors();
  return (
    <View>
      <Text style={{ color: colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 14, textAlign: "right", marginBottom: 8 }}>
        {label}{optional ? <Text style={{ color: colors.mutedForeground }}> (اختياري)</Text> : null}
      </Text>
      <View style={{ flexDirection: "row-reverse", alignItems: multiline ? "flex-start" : "center", gap: 10, backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: multiline ? 14 : 0, borderWidth: 1.5, borderColor: colors.border, minHeight: multiline ? 100 : 54 }}>
        <MaterialCommunityIcons name={icon as any} size={20} color={colors.mutedForeground} style={multiline ? { marginTop: 2 } : undefined} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          style={{ flex: 1, fontFamily: "Cairo_400Regular", fontSize: 14, color: colors.foreground, textAlign: "right", paddingVertical: multiline ? 0 : 16 }}
        />
      </View>
    </View>
  );
}

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
      <MaterialCommunityIcons name={icon as any} size={16} color="#C9A84C" style={{ marginTop: 3 }} />
      <Text style={{ color: "#FFFFFF66", fontFamily: "Cairo_400Regular", fontSize: 13, minWidth: 52 }}>{label}:</Text>
      <Text style={{ color: "#FFFFFF", fontFamily: "Cairo_600SemiBold", fontSize: 13, flex: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );
}
