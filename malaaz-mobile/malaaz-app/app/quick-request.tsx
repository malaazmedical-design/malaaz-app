import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Text, TextInput, View, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/ui";
import {
  SERVICE_CATEGORIES, ServiceType, CAIRO_AREAS, GIZA_AREAS,
  ALL_CITIES, PAYMENT_METHODS, PaymentMethod, ServiceSubOption,
} from "@/constants/data";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

type Step = 1 | 2 | 3 | 4;

export default function QuickRequestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, createBooking } = useApp();

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  // Step 1
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [selectedSub, setSelectedSub] = useState<ServiceSubOption | null>(null);

  // Step 2
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [city, setCity] = useState(profile.city || "القاهرة");
  const [area, setArea] = useState(profile.area);
  const [address, setAddress] = useState(profile.address);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  // Step 3 — دفع
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

  const areas = city === "القاهرة" ? CAIRO_AREAS : GIZA_AREAS;
  const subOptions = selectedService
    ? SERVICE_CATEGORIES.find((c) => c.id === selectedService)?.subOptions ?? []
    : [];

  const STEP_TITLES: Record<Step, string> = {
    1: "نوع الخدمة",
    2: "بياناتك",
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
      setAddress(label);
      if (geo.city?.includes("الجيزة") || geo.city?.includes("Giza")) {
        setCity("الجيزة");
      } else {
        setCity("القاهرة");
      }
      if (geo.district) {
        const matchCairo = CAIRO_AREAS.find((a) => geo.district!.includes(a) || a.includes(geo.district!));
        const matchGiza  = GIZA_AREAS.find((a) => geo.district!.includes(a) || a.includes(geo.district!));
        if (matchCairo) setArea(matchCairo);
        else if (matchGiza) { setCity("الجيزة"); setArea(matchGiza); }
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
      if (!selectedSub)    { Alert.alert("تنبيه", "اختار التخصص المطلوب"); return; }
    }
    if (step === 2) {
      if (!name.trim())  { Alert.alert("تنبيه", "يرجى إدخال اسمك"); return; }
      if (!phone.trim()) { Alert.alert("تنبيه", "يرجى إدخال رقم هاتفك"); return; }
      if (!area)         { Alert.alert("تنبيه", "يرجى اختيار المنطقة"); return; }
    }
    if (step === 3) {
      if (!paymentMethod) { Alert.alert("تنبيه", "اختار طريقة الدفع"); return; }
    }
    setStep((s) => (s + 1) as Step);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim(), city, area, address });
      await createBooking({
        serviceType: selectedService!,
        serviceName: selectedSub!.name,
        paymentMethod: paymentMethod!,
        notes: notes.trim() || undefined,
      });
      router.replace("/booking-success");
    } catch (err: any) {
      Alert.alert("خطأ", err.message ?? "حدث خطأ، يرجى المحاولة مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  };

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
              طلب سريع
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
            STEP 1 — اختيار الخدمة والتخصص
        ══════════════════════════════════════════════════════ */}
        {step === 1 && (
          <View style={{ gap: 20 }}>
            <View>
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 20, textAlign: "right", marginBottom: 14 }}>
                محتاج إيه؟
              </Text>
              {/* Service Picker */}
              <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 20 }}>
                {SERVICE_CATEGORIES.map((cat) => {
                  const isActive = selectedService === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => { setSelectedService(cat.id as ServiceType); setSelectedSub(null); }}
                      style={({ pressed }) => ({
                        flex: 1, alignItems: "center", padding: 12, borderRadius: 16, borderWidth: 2,
                        backgroundColor: isActive ? "#1C2B2A" : colors.card,
                        borderColor: isActive ? "#C9A84C" : colors.border,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      })}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: isActive ? "#C9A84C22" : "#1C2B2A10", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                        <MaterialCommunityIcons
                          name={cat.icon as any}
                          size={24}
                          color={isActive ? "#C9A84C" : "#1C2B2A"}
                        />
                      </View>
                      <Text style={{ color: isActive ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 12, textAlign: "center" }}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Sub-options */}
            {selectedService && (
              <View>
                <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", marginBottom: 12 }}>
                  اختار التخصص
                </Text>
                <View style={{ gap: 8 }}>
                  {subOptions.map((sub) => {
                    const isActive = selectedSub?.id === sub.id;
                    return (
                      <Pressable
                        key={sub.id}
                        onPress={() => setSelectedSub(sub)}
                        style={({ pressed }) => ({
                          flexDirection: "row-reverse", alignItems: "center", gap: 14,
                          padding: 14, borderRadius: 16, borderWidth: 2,
                          backgroundColor: isActive ? "#1C2B2A" : colors.card,
                          borderColor: isActive ? "#C9A84C" : colors.border,
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        })}
                      >
                        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: isActive ? "#C9A84C22" : "#1C2B2A10", alignItems: "center", justifyContent: "center" }}>
                          <MaterialCommunityIcons name={sub.icon as any} size={22} color={isActive ? "#C9A84C" : "#1C2B2A"} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: isActive ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 14, textAlign: "right" }}>
                            {sub.name}
                          </Text>
                          <Text style={{ color: isActive ? "#FFFFFF88" : colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right", marginTop: 2 }}>
                            {sub.description}
                          </Text>
                        </View>
                        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isActive ? "#C9A84C" : colors.border, backgroundColor: isActive ? "#C9A84C" : "transparent", alignItems: "center", justifyContent: "center" }}>
                          {isActive ? <MaterialCommunityIcons name="check" size={13} color="#1C2B2A" /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP 2 — بياناتك والعنوان
        ══════════════════════════════════════════════════════ */}
        {step === 2 && (
          <View style={{ gap: 16 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 20, textAlign: "right", marginBottom: 4 }}>
              بياناتك
            </Text>

            <Field label="الاسم الكامل" icon="account" value={name} onChange={setName} placeholder="مثال: محمد أحمد" />
            <Field label="رقم الهاتف" icon="phone" value={phone} onChange={setPhone} placeholder="01xxxxxxxxx" keyboardType="phone-pad" />

            {/* ─── تحديد الموقع ─── */}
            <View>
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 14, textAlign: "right", marginBottom: 8 }}>
                العنوان
              </Text>
              {/* GPS Button */}
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

              {/* Location detected label */}
              {locationLabel ? (
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: "#16A34A15", padding: 10, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: "#16A34A33" }}>
                  <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                  <Text style={{ color: "#16A34A", fontFamily: "Cairo_500Medium", fontSize: 12, flex: 1, textAlign: "right" }}>
                    {locationLabel}
                  </Text>
                </View>
              ) : null}

              {/* Manual address */}
              <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10, backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: colors.border, minHeight: 90 }}>
                <MaterialCommunityIcons name="map-marker" size={20} color={colors.mutedForeground} style={{ marginTop: 2 }} />
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

            {/* City */}
            <View>
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 14, textAlign: "right", marginBottom: 8 }}>المدينة</Text>
              <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                {ALL_CITIES.map((c) => (
                  <Pressable key={c} onPress={() => { setCity(c); setArea(""); }}
                    style={{ flex: 1, padding: 14, borderRadius: 14, borderWidth: 2, alignItems: "center", backgroundColor: city === c ? "#1C2B2A" : colors.card, borderColor: city === c ? "#C9A84C" : colors.border }}>
                    <Text style={{ color: city === c ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 14 }}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Area */}
            <View>
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 14, textAlign: "right", marginBottom: 8 }}>المنطقة</Text>
              <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
                {areas.map((a) => (
                  <Pressable key={a} onPress={() => setArea(a)}
                    style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 99, borderWidth: 1.5, backgroundColor: area === a ? "#1C2B2A" : colors.card, borderColor: area === a ? "#C9A84C" : colors.border }}>
                    <Text style={{ color: area === a ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_500Medium", fontSize: 13 }}>{a}</Text>
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
                  <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: isActive ? "#C9A84C22" : "#1C2B2A10", alignItems: "center", justifyContent: "center" }}>
                    <MaterialCommunityIcons name={pm.icon as any} size={28} color={isActive ? "#C9A84C" : "#1C2B2A"} />
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
              <SummaryRow icon="medical-bag"      label="الخدمة"       value={`${SERVICE_CATEGORIES.find((c) => c.id === selectedService)?.name} — ${selectedSub?.name}`} />
              <SummaryRow icon="account"          label="الاسم"        value={name} />
              <SummaryRow icon="phone"            label="الهاتف"       value={phone} />
              <SummaryRow icon="map-marker"       label="المنطقة"      value={`${area}، ${city}`} />
              {address ? <SummaryRow icon="home" label="العنوان"       value={address} /> : null}
              <SummaryRow icon="cash"             label="الدفع"        value={PAYMENT_METHODS.find((p) => p.id === paymentMethod)?.name ?? ""} />
              {notes ? <SummaryRow icon="note-text" label="ملاحظات"   value={notes} /> : null}
            </View>
            <View style={{ backgroundColor: "#C9A84C15", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#C9A84C33", flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
              <MaterialCommunityIcons name="information" size={18} color="#C9A84C" style={{ marginTop: 2 }} />
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "right", flex: 1, lineHeight: 22 }}>
                سيتواصل معك فريق ملاذ خلال 30 دقيقة لتأكيد الموعد وتعيين أفضل مقدم خدمة في منطقتك.
              </Text>
            </View>
          </View>
        )}

      </ScrollView>

      {/* ─── Footer Button ─── */}
      <View style={{ padding: 20, paddingBottom: insets.bottom + 16, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
        {step < 4 ? (
          <PrimaryButton label="التالي" icon="arrow-left" onPress={handleNext} />
        ) : (
          <PrimaryButton
            label={submitting ? "جاري الإرسال..." : "تأكيد الطلب"}
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
