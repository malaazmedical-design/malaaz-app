import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/i18n";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BenefitRow, GoldButton, Group, Row } from "@/components/account/AccountUI";
import { FamilySection } from "@/components/client/AccountSections";
import { TJ, setThemeOverride, useMalaz } from "@/constants/malazTheme";
import { useApp } from "@/contexts/AppContext";
import { whatsappCompany } from "@/lib/contact";
import { setLang, useLang } from "@/lib/i18n";

// يفتح صفحة التطبيق في المتجر (الحزمة الحالية حسب نسخة التطبيق)
const rateApp = () => {
  const pkg = Constants.expoConfig?.android?.package;
  const url = Platform.OS === "android" && pkg ? `market://details?id=${pkg}` : "https://play.google.com/store/apps/details?id=com.malaaz.homecare";
  Linking.openURL(url).catch(() => Linking.openURL(`https://play.google.com/store/apps/details?id=${pkg ?? "com.malaaz.homecare"}`).catch(() => {}));
};

const MEDICINES_KEY = "malaaz.medicines.v1";

export default function AccountScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { profile, client, needsPhone, clientLogout, addresses } = useApp();
  const lang = useLang();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [medCount, setMedCount] = useState(0);

  // number of saved medicine reminders, shown next to the row
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(MEDICINES_KEY)
      .then((raw) => setMedCount(raw ? JSON.parse(raw).length : 0))
      .catch(() => setMedCount(0));
  }, []));

  const displayName = profile.name || client?.name || "";
  const initial = (displayName.trim()[0] ?? "").toUpperCase();

  const confirmLogout = () =>
    Alert.alert("تسجيل الخروج؟", "هتقدر ترجع تسجل دخول في أي وقت.", [
      { text: "إلغاء", style: "cancel" },
      { text: "تسجيل الخروج", style: "destructive", onPress: () => clientLogout() },
    ]);

  const preferences = (
    <Group label="التفضيلات">
      <Row icon="bell-outline" title="الإشعارات" value="من إعدادات الجهاز" onPress={() => Linking.openSettings()} />
      <Row
        icon="weather-night"
        title="الوضع الداكن"
        toggle={{ on: t.isDark, onChange: (v) => setThemeOverride(v ? "dark" : "light") }}
      />
      <Row
        icon="translate"
        title="اللغة"
        value={lang === "en" ? "English" : "العربية"}
        onPress={() => Alert.alert("اللغة", "اختر لغة التطبيق", [
          { text: "العربية", onPress: () => setLang("ar") },
          { text: "English", onPress: () => setLang("en") },
          { text: "إلغاء", style: "cancel" },
        ])}
        last
      />
    </Group>
  );

  const help = (
    <Group label="المساعدة">
      <Row icon="headset" title="تواصل مع الدعم" onPress={() => whatsappCompany("مرحباً، محتاج مساعدة بخصوص تطبيق ملاذ")} />
      <Row icon="star-outline" title="قيّم التطبيق" onPress={rateApp} />
      <Row icon="file-document-outline" title="الشروط والسياسات" onPress={() => router.push("/legal")} last />
    </Group>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 20 + webTopInset, paddingHorizontal: 16, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 26, textAlign: "right", paddingHorizontal: 4 }}>حسابي</Text>

        {client ? (
          <>
            {/* ─── Profile card ─── */}
            <Animated.View
              entering={FadeInDown.delay(80).duration(500)}
              style={{ marginTop: 16, backgroundColor: t.card, borderRadius: 26, borderWidth: 1, borderColor: t.border, padding: 20, alignItems: "center" }}
            >
              <View style={{ width: 92, height: 92, borderRadius: 46, borderWidth: 2.5, borderColor: t.gold, padding: 3 }}>
                <View style={{ flex: 1, borderRadius: 43, backgroundColor: t.ic, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {profile.avatarUri ? (
                    <Image source={{ uri: profile.avatarUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 34 }}>{initial || "م"}</Text>
                  )}
                </View>
              </View>
              <Pressable
                onPress={() => router.push("/edit-profile")}
                accessibilityRole="button"
                accessibilityLabel="تعديل الملف"
                style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 12 }}
              >
                <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 22 }}>{displayName || "عميل ملاذ"}</Text>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: t.ic, alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name="pencil" size={14} color={t.gold} />
                </View>
              </Pressable>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 14, backgroundColor: t.ic, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 }}>
                <MaterialCommunityIcons name="map-marker-outline" size={15} color={t.gold} />
                <Text style={{ color: t.text, fontFamily: TJ.bold, fontSize: 12.5 }}>{addresses.length} عناوين محفوظة</Text>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(160).duration(500)} style={{ marginTop: 22 }}>
              <FamilySection />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(240).duration(500)}>
              <Group label="الصحة والعائلة">
                <Row icon="pill" title="تذكير الأدوية" value={medCount > 0 ? `${medCount} مفعّلة` : undefined} onPress={() => router.push("/medicines")} />
                <Row icon="microphone-message" title="ReVoice" value="تواصل العائلة" onPress={() => router.push("/mizo")} last />
              </Group>
              {preferences}
              {help}
              <Group label="الحساب">
                <Row icon="logout" title="تسجيل الخروج" danger onPress={confirmLogout} last />
              </Group>
            </Animated.View>
          </>
        ) : (
          <>
            {/* ─── Guest welcome ─── */}
            <Animated.View
              entering={FadeInDown.delay(80).duration(500)}
              style={{ marginTop: 16, backgroundColor: t.card, borderRadius: 26, borderWidth: 1, borderColor: t.border, padding: 22, alignItems: "center" }}
            >
              <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderStyle: "dashed", borderColor: t.gold, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="account-outline" size={40} color={t.gold} />
              </View>
              <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 21, marginTop: 14 }}>
                {needsPhone ? "كمّل بياناتك" : "أهلاً بيك في ملاذ"}
              </Text>
              <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, marginTop: 4, textAlign: "center" }}>
                {needsPhone ? "ناقص رقم موبايلك عشان نكمّل إنشاء حسابك" : "سجّل دخولك عشان تتابع حجوزاتك"}
              </Text>
              <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 18, alignSelf: "stretch" }}>
                <GoldButton
                  flex
                  label={needsPhone ? "إضافة رقم الموبايل" : "تسجيل الدخول"}
                  onPress={() => router.push("/client-auth")}
                />
              </View>
            </Animated.View>

            {/* ─── Benefits ─── */}
            <Animated.View entering={FadeInDown.delay(160).duration(500)} style={{ marginTop: 16, backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.border, overflow: "hidden" }}>
              <BenefitRow hot icon="pill" badge="مميز" title="تذكير الأدوية" desc="مواعيد أدويتك في وقتها، وإشعار لما تقرب الجرعة" />
              <BenefitRow hot icon="microphone-message" badge="جديد" title="ReVoice" desc="مساعد تواصل ذكي بين أفراد العائلة والمريض" />
              <BenefitRow icon="calendar-check-outline" title="تابع حجوزاتك" desc="حالة الزيارة وموعد وصول المزود في مكان واحد" />
              <BenefitRow icon="map-marker-outline" title="عناوينك محفوظة" desc="احجز في ثواني من غير ما تكتب العنوان كل مرة" last />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(240).duration(500)}>
              {preferences}
              {help}
              <Pressable onPress={() => router.push("/provider-portal")} style={{ alignItems: "center", paddingVertical: 22 }}>
                <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, textDecorationLine: "underline" }}>دخول مقدمي الخدمة</Text>
              </Pressable>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
