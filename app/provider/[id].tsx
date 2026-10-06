import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert, Platform, Pressable, ScrollView, Text, View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaymentMethod, PAYMENT_METHODS, ProviderService, TIME_PERIODS, providerCities } from "@/constants/data";
import { serviceIcon } from "@/constants/icons";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { callCompany, whatsappCompany } from "@/lib/contact";
import { useApp } from "@/contexts/AppContext";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
const REVIEWS_PREVIEW = 3;
const REVIEWS_MAX = 5;

function getNextDays(count: number) {
  const days: { key: string; label: string; sub: string }[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      // التاريخ بصيغة عربية مقروءة عشان يظهر كده في الحجز عند الأدمن والمقدم
      key: d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" }),
      label: i === 0 ? "اليوم" : i === 1 ? "غداً" : d.toLocaleDateString("ar-EG", { weekday: "short" }),
      sub: d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" }),
    });
  }
  return days;
}

export default function ProviderScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { providers, profile, client, createBooking, providerReviews, coverageAreas } = useApp();
  const provider = providers.find((p) => p.id === id);
  const reviews = (id && providerReviews[id]) || [];

  const [selectedService, setSelectedService] = useState<ProviderService | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState<string>(TIME_PERIODS[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const days = getNextDays(7);

  const GoldButton = ({ label, onPress, outline, icon }: { label: string; onPress: () => void; outline?: boolean; icon?: IconName }) => (
    <Pressable
      onPress={onPress}
      style={{
        height: 54, borderRadius: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8,
        backgroundColor: outline ? "transparent" : t.gold, borderWidth: outline ? 1.5 : 0, borderColor: t.gold,
      }}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={20} color={outline ? t.gold : t.onGold} /> : null}
      <Text style={{ color: outline ? t.gold : t.onGold, fontFamily: TJ.heavy, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );

  if (!provider) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <MaterialCommunityIcons name="account-question-outline" size={48} color={t.muted} />
        <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 16, marginTop: 12 }}>مقدم الخدمة غير موجود</Text>
        <View style={{ marginTop: 16, width: "100%" }}>
          <GoldButton label="رجوع" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const handleBook = async () => {
    if (!provider.available) return;
    // الحجز يتطلب حساب — الزائر يتحول لشاشة الدخول
    if (!client) {
      router.push("/client-auth");
      return;
    }
    if (!selectedService) { Alert.alert("تنبيه", "اختار الخدمة أولاً"); return; }
    if (!paymentMethod) { Alert.alert("تنبيه", "اختار طريقة الدفع"); return; }
    if (!profile.name || !profile.phone) {
      Alert.alert("تنبيه", "يرجى إدخال بياناتك من صفحة حسابي أولاً", [
        { text: "إلغاء", style: "cancel" },
        { text: "اذهب لحسابي", onPress: () => router.push("/profile") },
      ]);
      return;
    }

    setSubmitting(true);
    try {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await createBooking({
        serviceType: provider.serviceType,
        serviceName: selectedService.name,
        servicePrice: selectedService.price,
        providerId: provider.id,
        providerName: provider.name,
        // "أسرع وقت ممكن" مش محتاجة تاريخ — زي الموقع
        scheduledDate: selectedTime === TIME_PERIODS[0] ? undefined : days[selectedDay]?.key,
        scheduledTime: selectedTime,
        paymentMethod,
      });
      router.replace("/booking-success");
    } catch (err: any) {
      Alert.alert("خطأ", err.message ?? "حدث خطأ، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  };

  const ready = provider.available && !!selectedService && !!paymentMethod;
  const visibleReviews = showAllReviews ? reviews.slice(0, REVIEWS_MAX) : reviews.slice(0, REVIEWS_PREVIEW);
  const heading = { color: t.text, fontFamily: TJ.heavy, fontSize: 15, textAlign: "right" as const, marginBottom: 10 };
  const chip = (active: boolean) => ({
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5,
    backgroundColor: active ? t.goldTint : t.card, borderColor: active ? t.gold : t.border,
  });
  const chipText = (active: boolean) => ({ color: active ? t.gold : t.text, fontFamily: TJ.bold, fontSize: 13.5 });

  const smallChip = (label: string, icon: IconName) => (
    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 }}>
      <MaterialCommunityIcons name={icon} size={12} color={t.gold} />
      <Text style={{ color: t.text, fontFamily: TJ.bold, fontSize: 11 }}>{label}</Text>
    </View>
  );

  const hasPhoto = !!(provider.avatar && typeof provider.avatar === "object" && "uri" in provider.avatar);
  const govName = [...providerCities(provider.areas.length ? provider.areas : [provider.city], coverageAreas)][0] ?? provider.city;
  const glassBg = t.isDark ? "rgba(11,21,20,.62)" : "rgba(244,241,234,.62)";
  const glassBtn = (icon: IconName, onPress: () => void, color: string, label: string) => (
    <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.92 : 1 }] })}>
      <View style={{ width: 40, height: 40, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: t.border }}>
        <BlurView intensity={30} tint={t.isDark ? "dark" : "light"} style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: glassBg }}>
          <MaterialCommunityIcons name={icon} size={20} color={color} />
        </BlurView>
      </View>
    </Pressable>
  );

  const radio = (active: boolean) => (
    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: active ? t.gold : t.border, backgroundColor: active ? t.gold : "transparent", alignItems: "center", justifyContent: "center" }}>
      {active ? <MaterialCommunityIcons name="check" size={13} color={t.onGold} /> : null}
    </View>
  );

  const serviceCard = (key: string, icon: IconName, title: string, sub: string, price: string | null, active: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row-reverse", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, borderWidth: 1.5,
        backgroundColor: active ? t.selected : t.card, borderColor: active ? t.gold : t.border,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: t.goldRing, alignItems: "center", justifyContent: "center", backgroundColor: t.ic }}>
        <MaterialCommunityIcons name={icon} size={20} color={t.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 14, textAlign: "right" }}>{title}</Text>
        {price ? <Text style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 15, textAlign: "right" }}>{price}</Text> : null}
        {sub ? <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12, textAlign: "right" }}>{sub}</Text> : null}
      </View>
      {radio(active)}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(450)}>
        {/* ─── Hero: full-width photo ─── */}
        <View style={{ height: 330 + insets.top + webTopInset, backgroundColor: t.hdr, overflow: "hidden" }}>
          {hasPhoto ? (
            <Image source={provider.avatar} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" contentPosition={{ left: "50%", top: "20%" }} />
          ) : (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <LinearGradient colors={[t.ic, t.hdr]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
              <View style={{ position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: t.goldTint, top: 20 + insets.top }} />
              <Text style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 150, marginTop: insets.top - 20 }}>{(provider.name || "؟").trim().charAt(0)}</Text>
            </View>
          )}
          <LinearGradient colors={["rgba(0,0,0,.45)", "rgba(0,0,0,0)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 110 + insets.top }} />
          <LinearGradient colors={["rgba(0,0,0,0)", t.bg]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 200 }} />

          <View style={{ position: "absolute", top: insets.top + 14 + webTopInset, left: 16, right: 16, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
            {glassBtn("arrow-right", () => router.back(), t.gold, "رجوع")}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {/* التواصل دايماً مع رقم الشركة الرئيسي */}
              {glassBtn("whatsapp", () => whatsappCompany(`مرحباً، عندي استفسار عن مقدم الخدمة: ${provider.name} (${provider.title})`), t.whatsapp, "واتساب")}
              {glassBtn("phone-outline", callCompany, t.gold, "اتصال")}
            </View>
          </View>

          <View style={{ position: "absolute", left: 16, right: 16, bottom: 38, alignItems: "flex-end" }}>
            <View style={{ borderRadius: 14, overflow: "hidden", marginBottom: 10 }}>
              <BlurView intensity={30} tint={t.isDark ? "dark" : "light"} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 5, backgroundColor: glassBg }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: provider.available ? t.online : t.offline }} />
                <Text style={{ color: t.text, fontFamily: TJ.bold, fontSize: 13 }}>{provider.available ? "متاح خلال ساعة" : "غير متاح"}</Text>
              </BlurView>
            </View>
            <Text numberOfLines={2} style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 28, textAlign: "right", writingDirection: "ltr", alignSelf: "stretch" }}>{provider.name}</Text>
            <Text style={{ color: t.gold, fontFamily: TJ.bold, fontSize: 14.5, textAlign: "right", marginTop: 2 }}>{provider.title}</Text>
          </View>
        </View>

        {/* ─── Stats card (overlaps the hero) ─── */}
        <View style={{ marginTop: -22, marginHorizontal: 16, flexDirection: "row-reverse", backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 22, paddingVertical: 14 }}>
          {[
            { k: "التقييم", v: `${provider.rating.toFixed(1)} ★`, sub: provider.reviewsCount > 0 ? `${provider.reviewsCount} تقييم` : "" },
            { k: "الخبرة", v: `${provider.yearsExperience}`, sub: "سنة" },
            { k: "المنطقة", v: govName, sub: "" },
          ].map((c, i) => (
            <View key={c.k} style={{ flex: 1, alignItems: "center", paddingHorizontal: 4, borderLeftWidth: i < 2 ? 1 : 0, borderLeftColor: t.border }}>
              <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5 }}>{c.k}</Text>
              <Text numberOfLines={1} style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 17, marginTop: 3 }}>{c.v}</Text>
              {c.sub ? <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12 }}>{c.sub}</Text> : null}
            </View>
          ))}
        </View>

        {/* ─── Content ─── */}
        <View style={{ paddingTop: 6, paddingHorizontal: 16, gap: 26 }}>
          {provider.bio ? (
            <View>
              <Text style={heading}>نبذة</Text>
              <Text style={{ color: t.text2, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "right", lineHeight: 24 }}>{provider.bio}</Text>
            </View>
          ) : null}

          {!provider.available ? (
            <View style={{ backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.border, padding: 16, gap: 12 }}>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                <MaterialCommunityIcons name="account-clock-outline" size={26} color={t.muted} />
                <Text style={{ flex: 1, color: t.text, fontFamily: TJ.heavy, fontSize: 15, textAlign: "right" }}>غير متاح حالياً</Text>
              </View>
              <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "right", lineHeight: 22 }}>
                لا يمكن حجز {provider.name} الآن. اختر مقدم خدمة آخر متاح، أو اطلب خدمة سريعة وسنحدد لك مقدماً مناسباً.
              </Text>
              <GoldButton label="اختار مقدم آخر" icon="account-search" onPress={() => router.replace("/(tabs)")} />
              <GoldButton label="طلب خدمة سريعة" icon="lightning-bolt" outline onPress={() => router.replace("/quick-request")} />
            </View>
          ) : null}

          {/* ─── اختيار الخدمة ─── */}
          <View>
            <Text style={heading}>اختار الخدمة</Text>
            {provider.services.length === 0 ? (
              <View style={{ gap: 10 }}>
                <View style={{ backgroundColor: t.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: t.border, alignItems: "center", gap: 8 }}>
                  <MaterialCommunityIcons name="clipboard-text-off-outline" size={30} color={t.muted} />
                  <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13, textAlign: "center" }}>لم يحدد خدماته بعد</Text>
                </View>
                {serviceCard(
                  "direct", "calendar-check", "احجز مباشرًا", "سيتم تحديد التفاصيل والسعر لاحقاً", null,
                  selectedService?.id === "direct",
                  () => setSelectedService({ id: "direct", name: "حجز مباشر", description: "سيتم تحديد تفاصيل الخدمة والسعر", price: 0, durationLabel: "" }),
                )}
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {provider.services.map((svc) =>
                  serviceCard(
                    svc.id, serviceIcon(svc.name) as IconName, svc.name,
                    [svc.description, svc.durationLabel].filter(Boolean).join(" · "),
                    `${svc.price} ج.م`,
                    selectedService?.id === svc.id,
                    () => setSelectedService(svc),
                  ),
                )}
              </View>
            )}
          </View>

          {/* ─── الموعد ─── */}
          <View>
            <Text style={heading}>اختار الفترة</Text>
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
              {TIME_PERIODS.map((p) => (
                <Pressable key={p} onPress={() => setSelectedTime(p)} style={chip(selectedTime === p)}>
                  <Text style={chipText(selectedTime === p)}>{p}</Text>
                </Pressable>
              ))}
            </View>
            {/* اختيار اليوم — يظهر بس لو مش "أسرع وقت ممكن" */}
            {selectedTime !== TIME_PERIODS[0] ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", gap: 8, marginTop: 12 }}>
                {days.map((d, i) => (
                  <Pressable key={d.key} onPress={() => setSelectedDay(i)} style={[chip(selectedDay === i), { alignItems: "center", minWidth: 72 }]}>
                    <Text style={{ color: selectedDay === i ? t.gold : t.muted, fontFamily: TJ.medium, fontSize: 11.5 }}>{d.label}</Text>
                    <Text style={{ color: selectedDay === i ? t.gold : t.text, fontFamily: TJ.heavy, fontSize: 14, marginTop: 2 }}>{d.sub}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>

          {/* ─── طريقة الدفع ─── */}
          <View>
            <Text style={heading}>طريقة الدفع</Text>
            <View style={{ flexDirection: "row-reverse", gap: 8 }}>
              {PAYMENT_METHODS.map((opt) => {
                const active = paymentMethod === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setPaymentMethod(opt.id)}
                    style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 16, borderWidth: 1.5, backgroundColor: active ? t.selected : t.card, borderColor: active ? t.gold : t.border }}
                  >
                    <MaterialCommunityIcons name={opt.icon as IconName} size={20} color={active ? t.gold : t.muted} />
                    <Text style={{ color: active ? t.gold : t.text, fontFamily: TJ.bold, fontSize: 12.5, textAlign: "center" }}>{opt.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {reviews.length > 0 ? (
            <View>
              <Text style={heading}>آراء العملاء ({reviews.length}) ★</Text>
              <View style={{ gap: 8 }}>
                {visibleReviews.map((r, i) => (
                  <View key={i} style={{ backgroundColor: t.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: t.border }}>
                    <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 14 }}>{r.clientName}</Text>
                      <Text style={{ color: t.gold, fontSize: 12, letterSpacing: 1 }}>{"★".repeat(Math.max(0, Math.min(5, Math.round(r.rating))))}</Text>
                    </View>
                    {r.text ? (
                      <Text style={{ color: t.text2, fontFamily: TJ.medium, fontSize: 13, textAlign: "right", lineHeight: 21, marginTop: 4 }}>{r.text}</Text>
                    ) : null}
                  </View>
                ))}
                {!showAllReviews && reviews.length > REVIEWS_PREVIEW ? (
                  <Pressable onPress={() => setShowAllReviews(true)} style={{ height: 46, borderRadius: 14, borderWidth: 1.5, borderColor: t.gold, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: t.gold, fontFamily: TJ.bold, fontSize: 14 }}>عرض المزيد ({Math.min(reviews.length, REVIEWS_MAX) - REVIEWS_PREVIEW})</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

        </View>
        </Animated.View>
      </ScrollView>

      {/* ─── Fixed footer ─── */}
      <BlurView intensity={40} tint={t.isDark ? "dark" : "light"} style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 18, backgroundColor: glassBg, borderTopWidth: 1, borderTopColor: t.border }}>
        <Pressable
          onPress={handleBook}
          disabled={submitting || !provider.available}
          style={{ height: 54, borderRadius: 18, backgroundColor: t.gold, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, opacity: ready && !submitting ? 1 : 0.45 }}
        >
          <MaterialCommunityIcons name="calendar-check" size={20} color={t.onGold} />
          <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 17 }}>{!provider.available ? "غير متاح حالياً" : submitting ? "جاري الحجز..." : "تأكيد الحجز"}</Text>
        </Pressable>
      </BlurView>
    </View>
  );
}
