import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert, Linking, Platform, Pressable, ScrollView, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/ui";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

const TERMS_URL = "https://malaaz-plum.vercel.app/privacy.html";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, logout } = useApp();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [phone2, setPhone2] = useState(profile.phone2 ?? "");
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [address, setAddress] = useState(profile.address);
  const [avatarUri, setAvatarUri] = useState(profile.avatarUri ?? "");
  const [terms, setTerms] = useState(profile.termsAccepted ?? false);
  const [locating, setLocating] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [detectedArea, setDetectedArea] = useState("");
  const [detectedCity, setDetectedCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setPhone(profile.phone);
    setPhone2(profile.phone2 ?? "");
    setWhatsapp(profile.whatsapp ?? "");
    setEmail(profile.email ?? "");
    setAddress(profile.address);
    setAvatarUri(profile.avatarUri ?? "");
    setTerms(profile.termsAccepted ?? false);
  }, [profile]);

  const hasData = !!profile.name && !!profile.phone;

  // ─── صورة العميل (محفوظة على الجهاز) ─────────────────────────────────────
  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!result.canceled && result.assets?.[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  // ─── تحديد الموقع تلقائياً ────────────────────────────────────────────────
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
      if (geo.district) setDetectedArea(geo.district);
      setDetectedCity(geo.city?.includes("الجيزة") || geo.city?.includes("Giza") ? "الجيزة" : "القاهرة");
    } catch {
      Alert.alert("خطأ", "تعذّر تحديد الموقع، يرجى كتابة العنوان يدوياً");
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("تنبيه", "يرجى إدخال الاسم ورقم الهاتف");
      return;
    }
    if (!terms) {
      Alert.alert("تنبيه", "يرجى الموافقة على الشروط وسياسة الخصوصية أولاً");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        phone2: phone2.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim(),
        avatarUri: avatarUri || undefined,
        termsAccepted: terms,
        ...(detectedArea ? { area: detectedArea } : {}),
        ...(detectedCity ? { city: detectedCity } : {}),
      });
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
        {/* Avatar — اضغط لتغيير الصورة */}
        <View style={{ alignItems: "center", marginTop: 16 }}>
          <Pressable onPress={pickAvatar} style={{ position: "relative" }}>
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: "#C9A84C22", borderWidth: 3, borderColor: "#C9A84C", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <MaterialCommunityIcons name="account" size={44} color="#C9A84C" />
              )}
            </View>
            <View style={{ position: "absolute", bottom: -2, left: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: "#C9A84C", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#1C2B2A" }}>
              <MaterialCommunityIcons name="camera" size={14} color="#1C2B2A" />
            </View>
          </Pressable>
          {hasData ? (
            <Text style={{ color: "#FFFFFF", fontFamily: "Cairo_600SemiBold", fontSize: 16, marginTop: 10 }}>{profile.name}</Text>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100, gap: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right" }}>بياناتك الشخصية</Text>

        <FieldInput label="الاسم الكامل" icon="account" value={name} onChange={setName} placeholder="مثال: محمد أحمد" />
        <FieldInput label="رقم الهاتف" icon="phone" value={phone} onChange={setPhone} placeholder="01xxxxxxxxx" keyboardType="phone-pad" />
        <FieldInput label="رقم اتصال إضافي" icon="phone-plus" value={phone2} onChange={setPhone2} placeholder="01xxxxxxxxx" keyboardType="phone-pad" optional />
        <FieldInput label="رقم واتساب" icon="whatsapp" value={whatsapp} onChange={setWhatsapp} placeholder="01xxxxxxxxx" keyboardType="phone-pad" optional />
        <FieldInput label="البريد الإلكتروني" icon="email" value={email} onChange={setEmail} placeholder="example@gmail.com" keyboardType="email-address" optional />

        {/* ─── العنوان ─── */}
        <View>
          <Text style={{ color: colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 14, textAlign: "right", marginBottom: 8 }}>العنوان</Text>

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

        {/* ─── الموافقة على الشروط ─── */}
        <Pressable
          onPress={() => setTerms((t) => !t)}
          style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, padding: 4 }}
        >
          <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: terms ? "#C9A84C" : colors.border, backgroundColor: terms ? "#C9A84C" : "transparent", alignItems: "center", justifyContent: "center" }}>
            {terms ? <MaterialCommunityIcons name="check" size={15} color="#1C2B2A" /> : null}
          </View>
          <Text style={{ flex: 1, color: colors.foreground, fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "right" }}>
            أوافق على{" "}
            <Text
              onPress={() => Linking.openURL(TERMS_URL)}
              style={{ color: "#b8860b", fontFamily: "Cairo_700Bold", textDecorationLine: "underline" }}
            >
              الشروط وسياسة الخصوصية
            </Text>
          </Text>
        </Pressable>

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

function FieldInput({ label, icon, value, onChange, placeholder, keyboardType, optional }: {
  label: string; icon: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; optional?: boolean;
}) {
  const colors = useColors();
  return (
    <View>
      <Text style={{ color: colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 14, textAlign: "right", marginBottom: 8 }}>
        {label}{optional ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}> (اختياري)</Text> : null}
      </Text>
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
    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <MaterialCommunityIcons name={icon as any} size={15} color="#C9A84C" />
      <Text style={{ color: "#FFFFFFCC", fontFamily: "Cairo_400Regular", fontSize: 13 }}>{text}</Text>
    </View>
  );
}
