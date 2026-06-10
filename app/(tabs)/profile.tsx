import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  Alert, Platform, Pressable, ScrollView, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/ui";
import { CAIRO_AREAS, GIZA_AREAS, ALL_CITIES } from "@/constants/data";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, logout } = useApp();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [city, setCity] = useState(profile.city || "القاهرة");
  const [area, setArea] = useState(profile.area);
  const [address, setAddress] = useState(profile.address);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setPhone(profile.phone);
    setCity(profile.city || "القاهرة");
    setArea(profile.area);
    setAddress(profile.address);
  }, [profile]);

  const areas = city === "القاهرة" ? CAIRO_AREAS : GIZA_AREAS;
  const hasData = !!profile.name && !!profile.phone;

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("تنبيه", "يرجى إدخال الاسم ورقم الهاتف");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim(), city, area, address: address.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      Alert.alert("خطأ", "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("تسجيل الخروج", "هل تريد مسح بياناتك؟", [
      { text: "لا", style: "cancel" },
      { text: "نعم", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: "#1C2B2A", paddingTop: insets.top + 16 + webTopInset, paddingBottom: 28, paddingHorizontal: 20 }}>
        <Text style={{ color: "#C9A84C", fontFamily: "Cairo_700Bold", fontSize: 22, textAlign: "right" }}>حسابي</Text>
        <Text style={{ color: "#FFFFFF66", fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "right", marginTop: 4 }}>
          {hasData ? `أهلاً ${profile.name.split(" ")[0]} 👋` : "أدخل بياناتك للبدء"}
        </Text>
        {/* Avatar */}
        <View style={{ alignItems: "center", marginTop: 16 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#C9A84C22", borderWidth: 3, borderColor: "#C9A84C", alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name="account" size={44} color="#C9A84C" />
          </View>
          {hasData ? (
            <Text style={{ color: "#FFFFFF", fontFamily: "Cairo_600SemiBold", fontSize: 16, marginTop: 10 }}>{profile.name}</Text>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100, gap: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right" }}>بياناتك الشخصية</Text>

        {/* Name */}
        <FieldInput label="الاسم الكامل" icon="account" value={name} onChange={setName} placeholder="مثال: محمد أحمد" />
        {/* Phone */}
        <FieldInput label="رقم الهاتف" icon="phone" value={phone} onChange={setPhone} placeholder="01xxxxxxxxx" keyboardType="phone-pad" />
        {/* Address */}
        <FieldInput label="العنوان" icon="map-marker" value={address} onChange={setAddress} placeholder="الشارع، العمارة، الدور..." />

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
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, borderWidth: 1.5, backgroundColor: area === a ? "#1C2B2A" : colors.card, borderColor: area === a ? "#C9A84C" : colors.border }}>
                <Text style={{ color: area === a ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_500Medium", fontSize: 12 }}>{a}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Save Button */}
        <PrimaryButton
          label={saved ? "تم الحفظ ✓" : saving ? "جاري الحفظ..." : "حفظ البيانات"}
          icon={saved ? "check" : "content-save"}
          loading={saving}
          onPress={handleSave}
        />

        {/* App Info */}
        <View style={{ backgroundColor: "#1C2B2A", borderRadius: 18, padding: 16, marginTop: 8, borderWidth: 1, borderColor: "#C9A84C33" }}>
          <Text style={{ color: "#C9A84C", fontFamily: "Cairo_700Bold", fontSize: 14, textAlign: "right", marginBottom: 12 }}>عن ملاذ</Text>
          <InfoLine icon="phone" text="01039091989" />
          <InfoLine icon="whatsapp" text="واتساب: 01039091989" />
          <InfoLine icon="information" text="خدمات طبية منزلية — القاهرة والجيزة" />
          <InfoLine icon="shield-check" text="الإصدار 1.0.0" />
        </View>

        {/* Provider portal entry */}
        <Pressable
          onPress={() => router.push("/provider-portal")}
          style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: "#C9A84C55", backgroundColor: "#C9A84C14" }}
        >
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
            <MaterialCommunityIcons name="doctor" size={22} color="#b8860b" />
            <View>
              <Text style={{ color: "#1C2B2A", fontFamily: "Cairo_700Bold", fontSize: 14, textAlign: "right" }}>هل أنت مقدم خدمة؟</Text>
              <Text style={{ color: "#b8860b", fontFamily: "Cairo_400Regular", fontSize: 11, textAlign: "right" }}>ادخل لبوابة مقدمي الخدمة — تابع حجوزاتك وأسعارك</Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-left" size={22} color="#b8860b" />
        </Pressable>

        {/* Logout */}
        {hasData ? (
          <Pressable onPress={handleLogout}
            style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: "#DC262633", backgroundColor: "#FEE2E2" }}>
            <MaterialCommunityIcons name="logout" size={18} color="#DC2626" />
            <Text style={{ color: "#DC2626", fontFamily: "Cairo_600SemiBold", fontSize: 14 }}>مسح البيانات</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function FieldInput({ label, icon, value, onChange, placeholder, keyboardType }: {
  label: string; icon: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any;
}) {
  const colors = useColors();
  return (
    <View>
      <Text style={{ color: colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 14, textAlign: "right", marginBottom: 8 }}>{label}</Text>
      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14, height: 54, borderWidth: 1.5, borderColor: colors.border }}>
        <MaterialCommunityIcons name={icon as any} size={20} color={colors.mutedForeground} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          keyboardType={keyboardType}
          style={{ flex: 1, fontFamily: "Cairo_400Regular", fontSize: 14, color: colors.foreground, textAlign: "right" }}
        />
      </View>
    </View>
  );
}

function InfoLine({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <MaterialCommunityIcons name={icon as any} size={16} color="#C9A84C" />
      <Text style={{ color: "#FFFFFF99", fontFamily: "Cairo_400Regular", fontSize: 13 }}>{text}</Text>
    </View>
  );
}
