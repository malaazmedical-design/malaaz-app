import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert, Linking, Platform, Pressable, ScrollView, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, Pill, PrimaryButton, Stars } from "@/components/ui";
import { ProviderService } from "@/constants/data";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

const TIME_SLOTS = ["09:00", "10:30", "12:00", "14:00", "16:00", "18:00", "20:00"];

function getNextDays(count: number) {
  const days: { key: string; label: string; sub: string }[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      key: d.toISOString().slice(0, 10),
      label: i === 0 ? "اليوم" : i === 1 ? "غداً" : d.toLocaleDateString("ar-SA", { weekday: "short" }),
      sub: d.toLocaleDateString("ar-SA", { day: "numeric", month: "short" }),
    });
  }
  return days;
}

export default function ProviderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { providers, profile, createBooking } = useApp();
  const provider = providers.find((p) => p.id === id);

  const [selectedService, setSelectedService] = useState<ProviderService | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "instapay" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // بيانات العميل — مملية من البروفايل لو موجود
  const [guestName, setGuestName] = useState(profile.name);
  const [guestPhone, setGuestPhone] = useState(profile.phone);
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const days = getNextDays(7);

  if (!provider) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <MaterialCommunityIcons name="account-question-outline" size={48} color={colors.mutedForeground} />
        <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", marginTop: 12 }}>مقدم الخدمة غير موجود</Text>
        <View style={{ marginTop: 16 }}>
          <PrimaryButton label="رجوع" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const handleBook = async () => {
    if (!selectedService) { Alert.alert("تنبيه", "اختار الخدمة أولاً"); return; }
    if (!paymentMethod) { Alert.alert("تنبيه", "اختار طريقة الدفع"); return; }
    if (!guestName.trim()) { Alert.alert("تنبيه", "يرجى إدخال اسمك"); return; }
    if (!guestPhone.trim()) { Alert.alert("تنبيه", "يرجى إدخال رقم هاتفك"); return; }

    setSubmitting(true);
    try {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await createBooking({
        serviceType: provider.serviceType,
        serviceName: selectedService.name,
        servicePrice: selectedService.price,
        providerId: provider.id,
        providerName: provider.name,
        scheduledDate: days[selectedDay]?.key,
        scheduledTime: selectedTime ?? undefined,
        paymentMethod,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
      });
      router.replace("/booking-success");
    } catch (err: any) {
      Alert.alert("خطأ", err.message ?? "حدث خطأ، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>

        {/* ─── Hero ─── */}
        <LinearGradient colors={["#1C2B2A", "#243635"]} style={{ paddingTop: insets.top + 12 + webTopInset, paddingBottom: 28, paddingHorizontal: 20 }}>
          <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#FFFFFF15", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#C9A84C" />
          </Pressable>

          <View style={{ flexDirection: "row-reverse", gap: 16, alignItems: "center" }}>
            <Image source={provider.avatar} style={{ width: 88, height: 88, borderRadius: 24, borderWidth: 3, borderColor: "#C9A84C" }} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 20, textAlign: "right" }}>{provider.name}</Text>
              <Text style={{ color: "#C9A84C", fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "right", marginTop: 4 }}>{provider.title}</Text>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 8 }}>
                <Stars rating={provider.rating} size={14} />
                <Text style={{ color: "#FFFFFF88", fontFamily: "Cairo_400Regular", fontSize: 12 }}>
                  {provider.rating.toFixed(1)} ({provider.reviewsCount} تقييم)
                </Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 16 }}>
            <Pill label={`${provider.yearsExperience} سنة خبرة`} icon="medal" />
            <Pill label={provider.responseTime} icon="clock-fast" tone={provider.available ? "success" : "default"} />
            <Pressable onPress={() => Linking.openURL(`tel:${provider.phone}`)}
              style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: "#C9A84C22", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: "#C9A84C44" }}>
              <MaterialCommunityIcons name="phone" size={13} color="#C9A84C" />
              <Text style={{ color: "#C9A84C", fontFamily: "Cairo_600SemiBold", fontSize: 12 }}>اتصال</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <View style={{ padding: 20, gap: 24 }}>

          {/* Bio */}
          {provider.bio ? (
            <View>
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", marginBottom: 8 }}>نبذة</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 14, textAlign: "right", lineHeight: 24 }}>{provider.bio}</Text>
            </View>
          ) : null}

          {/* ─── اختيار الخدمة ─── */}
          <View>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", marginBottom: 12 }}>اختار الخدمة</Text>
            <View style={{ gap: 8 }}>
              {provider.services.map((svc) => {
                const isActive = selectedService?.id === svc.id;
                return (
                  <Pressable key={svc.id} onPress={() => setSelectedService(svc)}
                    style={({ pressed }) => ({ flexDirection: "row-reverse", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 2, backgroundColor: isActive ? "#1C2B2A" : colors.card, borderColor: isActive ? "#C9A84C" : colors.border, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: isActive ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 14, textAlign: "right" }}>{svc.name}</Text>
                      <Text style={{ color: isActive ? "#FFFFFF88" : colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right", marginTop: 3 }}>{svc.description}</Text>
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 8 }}>
                        <Text style={{ color: isActive ? "#C9A84C" : "#1C2B2A", fontFamily: "Cairo_700Bold", fontSize: 15 }}>{svc.price} ج.م</Text>
                        <Text style={{ color: isActive ? "#FFFFFF66" : colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 11 }}>{svc.durationMinutes} دقيقة</Text>
                      </View>
                    </View>
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isActive ? "#C9A84C" : colors.border, backgroundColor: isActive ? "#C9A84C" : "transparent", alignItems: "center", justifyContent: "center" }}>
                      {isActive ? <MaterialCommunityIcons name="check" size={13} color="#1C2B2A" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ─── الموعد ─── */}
          <View>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", marginBottom: 12 }}>اختار الموعد</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: "row-reverse", paddingBottom: 4 }}>
              {days.map((d, i) => (
                <Pressable key={d.key} onPress={() => setSelectedDay(i)}
                  style={{ alignItems: "center", padding: 12, borderRadius: 14, minWidth: 64, borderWidth: 2, backgroundColor: selectedDay === i ? "#1C2B2A" : colors.card, borderColor: selectedDay === i ? "#C9A84C" : colors.border }}>
                  <Text style={{ color: selectedDay === i ? "#C9A84C" : colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 11 }}>{d.label}</Text>
                  <Text style={{ color: selectedDay === i ? "#FFFFFF" : colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 14, marginTop: 4 }}>{d.sub}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {TIME_SLOTS.map((t) => (
                <Pressable key={t} onPress={() => setSelectedTime(t)}
                  style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, backgroundColor: selectedTime === t ? "#1C2B2A" : colors.card, borderColor: selectedTime === t ? "#C9A84C" : colors.border }}>
                  <Text style={{ color: selectedTime === t ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 13 }}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ─── بياناتك ─── */}
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", marginBottom: 4 }}>بياناتك</Text>
            {[
              { label: "الاسم الكامل", icon: "account", value: guestName, onChange: setGuestName, placeholder: "مثال: محمد أحمد", keyboardType: "default" },
              { label: "رقم الهاتف", icon: "phone", value: guestPhone, onChange: setGuestPhone, placeholder: "01xxxxxxxxx", keyboardType: "phone-pad" },
            ].map((f) => (
              <View key={f.label}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_600SemiBold", fontSize: 13, textAlign: "right", marginBottom: 6 }}>{f.label}</Text>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14, height: 52, borderWidth: 1.5, borderColor: colors.border }}>
                  <MaterialCommunityIcons name={f.icon as any} size={18} color={colors.mutedForeground} />
                  <TextInput
                    value={f.value}
                    onChangeText={f.onChange}
                    placeholder={f.placeholder}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType={f.keyboardType as any}
                    style={{ flex: 1, fontFamily: "Cairo_400Regular", fontSize: 14, color: colors.foreground, textAlign: "right" }}
                  />
                </View>
              </View>
            ))}
          </View>

          {/* ─── طريقة الدفع ─── */}
          <View>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", marginBottom: 12 }}>طريقة الدفع</Text>
            <View style={{ flexDirection: "row-reverse", gap: 8 }}>
              {[
                { key: "cash" as const, label: "كاش", icon: "cash" },
                { key: "instapay" as const, label: "إنستاباي", icon: "contactless-payment" },
              ].map((opt) => (
                <Pressable key={opt.key} onPress={() => setPaymentMethod(opt.key)}
                  style={{ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 2, backgroundColor: paymentMethod === opt.key ? "#1C2B2A" : colors.card, borderColor: paymentMethod === opt.key ? "#C9A84C" : colors.border }}>
                  <MaterialCommunityIcons name={opt.icon as any} size={20} color={paymentMethod === opt.key ? "#C9A84C" : colors.mutedForeground} />
                  <Text style={{ color: paymentMethod === opt.key ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 14 }}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

        </View>
      </ScrollView>

      {/* ─── Sticky Book Button ─── */}
      <View style={{ padding: 20, paddingBottom: insets.bottom + 16, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
        {selectedService ? (
          <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 13 }}>الإجمالي</Text>
            <Text style={{ color: "#C9A84C", fontFamily: "Cairo_700Bold", fontSize: 22 }}>{selectedService.price} ج.م</Text>
          </View>
        ) : null}
        <PrimaryButton
          label={submitting ? "جاري الحجز..." : "تأكيد الحجز"}
          icon={submitting ? undefined : "calendar-check"}
          loading={submitting}
          disabled={!selectedService || !paymentMethod}
          onPress={handleBook}
        />
      </View>
    </View>
  );
}
