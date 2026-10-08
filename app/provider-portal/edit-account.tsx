import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PText, SearchableSelect, useCheckBurst } from "@/components/provider/PUI";
import { FALLBACK_SPECIALTIES, gradesFor } from "@/lib/providerLists";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { useProvider } from "@/contexts/ProviderContext";
import { supabase } from "@/lib/supabase";

const DARK = "#1C2B2A";
const GOLD = "#C9A84C";


const TYPE_LABEL: Record<string, string> = { "كشف منزلي": "كشف منزلي", "تمريض منزلي": "تمريض منزلي", "أشعة منزلية": "أشعة منزلية" };

export default function ProviderProfileScreen() {
  const t = useMalaz();
  const burst = useCheckBurst();
  const [micOn, setMicOn] = useState(false);
  const insets = useSafeAreaInsets();
  const { provider, areas, subServices, saveProfile, logout } = useProvider();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [exp, setExp] = useState("");
  const [bio, setBio] = useState("");
  const [price, setPrice] = useState("");
  const [serviceType, setServiceType] = useState("كشف منزلي");
  const [grade, setGrade] = useState("");
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [areaSearch, setAreaSearch] = useState("");
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!provider) return;
    setName(provider.name ?? "");
    setPhone(provider.phone ?? "");
    setExp(provider.experience ? String(provider.experience) : "");
    setBio(provider.bio ?? "");
    setPrice(provider.price ? String(provider.price) : "");
    setServiceType(provider.service_type ?? "كشف منزلي");
    setGrade(provider.grade && gradesFor(provider.service_type).includes(provider.grade) ? provider.grade : "");
    setSpecialty(provider.specialty ?? null);
    setPhotoUrl(provider.photo_url ?? null);
    const saved = (provider.areas ?? provider.area ?? "").split(",").map((a) => a.trim()).filter(Boolean);
    setSelectedAreas(saved);
    // افتح المحافظات اللي فيها مناطق محددة تلقائياً
    if (saved.length > 0 && areas.length > 0) {
      const cities = new Set(areas.filter((a) => saved.includes(a.name)).map((a) => a.city));
      setExpandedCities(cities);
    }
  }, [provider, areas]);

  // تخصصات الكشف المنزلي من sub_services (نفس مصدر الموقع)
  const specialties = useMemo(
    () => subServices.filter((s) => s.service_name === "كشف منزلي" && s.group_name === "specialty"),
    [subServices]
  );

  // تجميع المناطق حسب المحافظة مع دعم البحث
  const groupedAreas = useMemo(() => {
    const q = areaSearch.trim();
    const filtered = q
      ? areas.filter((a) => a.name.includes(q) || a.city.includes(q))
      : areas;
    const map = new Map<string, typeof areas>();
    for (const a of filtered) {
      if (!map.has(a.city)) map.set(a.city, []);
      map.get(a.city)!.push(a);
    }
    return map;
  }, [areas, areaSearch]);

  const toggleCity = (city: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCities((prev) => {
      const next = new Set(prev);
      next.has(city) ? next.delete(city) : next.add(city);
      return next;
    });
  };

  const toggleAllInCity = (city: string, cityAreas: typeof areas) => {
    const names = cityAreas.map((a) => a.name);
    const allSelected = names.every((n) => selectedAreas.includes(n));
    if (allSelected) {
      setSelectedAreas((prev) => prev.filter((a) => !names.includes(a)));
    } else {
      setSelectedAreas((prev) => [...new Set([...prev, ...names])]);
    }
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0] || !provider) return;

    setUploading(true);
    try {
      // الجلسة ممكن تبقى انتهت/فقدت من غير ما تظهر في الواجهة — تحقق قبل الرفع
      // لأن غيرها بيوصل خطأ RLS مش مفهوم بدل رسالة واضحة
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert("انتهت الجلسة", "سجّل دخولك تاني وحاول من جديد");
        await logout();
        router.replace("/provider-portal/login");
        return;
      }

      const asset = result.assets[0];
      const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase();
      const fileName = `${provider.id}-${Date.now()}.${ext}`;
      const response = await fetch(asset.uri);
      const blob = await response.arrayBuffer();

      const { error } = await supabase.storage
        .from("provider-photos")
        .upload(fileName, blob, { upsert: true, contentType: asset.mimeType ?? "image/jpeg" });
      if (error) throw new Error(error.message);

      const { data } = supabase.storage.from("provider-photos").getPublicUrl(fileName);
      setPhotoUrl(data.publicUrl);
      Alert.alert("تم", "✅ تم رفع الصورة — اضغط حفظ لتأكيد");
    } catch (e: any) {
      Alert.alert("خطأ", "تعذر رفع الصورة: " + (e.message ?? ""));
    } finally {
      setUploading(false);
    }
  };

  const toggleArea = (areaName: string) => {
    setSelectedAreas((prev) =>
      prev.includes(areaName) ? prev.filter((a) => a !== areaName) : [...prev, areaName]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("تنبيه", "أدخل اسمك"); return; }
    if (grades.length && !grade) { Alert.alert("تنبيه", isNurse ? "اختر الدرجة: أخصائي تمريض أو فني تمريض" : "اختر الدرجة العلمية: أخصائي أو استشاري"); return; }
    if (isDoctor && !specialty) { Alert.alert("تنبيه", "اختر التخصص"); return; }
    if (!selectedAreas.length) { Alert.alert("تنبيه", "اختر منطقة واحدة على الأقل"); return; }
    setSaving(true);
    try {
      await saveProfile({
        name: name.trim(),
        phone: phone.trim(),
        experience: exp ? parseFloat(exp) : null,
        bio: bio.trim(),
        areas: selectedAreas,
        serviceType,
        grade,
        specialty: serviceType === "كشف منزلي" ? specialty : (specialty ?? provider?.specialty ?? null),
        photoUrl,
      });
      burst.show("تم حفظ الحساب");
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const isDoctor = serviceType === "كشف منزلي";
  const isNurse = serviceType === "تمريض منزلي";
  const grades = gradesFor(serviceType);

  // الإملاء الصوتي: Web Speech API على الويب فقط — على الموبايل رسالة بديلة
  const toggleMic = () => {
    const SR = Platform.OS === "web" ? ((globalThis as any).SpeechRecognition ?? (globalThis as any).webkitSpeechRecognition) : null;
    if (!SR) {
      Alert.alert("الإملاء الصوتي", "الإملاء الصوتي غير مدعوم على جهازك. استخدم ميكروفون الكيبورد للكتابة بصوتك.");
      return;
    }
    if (micOn) { setMicOn(false); return; }
    const rec = new SR();
    rec.lang = "ar-EG";
    rec.onresult = (e: any) => setBio((prev) => (prev ? prev + " " : "") + e.results[0][0].transcript);
    rec.onend = () => setMicOn(false);
    rec.onerror = () => setMicOn(false);
    setMicOn(true);
    rec.start();
  };

  const input = {
    height: 48, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.card,
    color: t.text, paddingHorizontal: 14, fontSize: 15, fontFamily: TJ.medium, textAlign: "right" as const,
  };
  const label = (txt: string) => (
    <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "right", marginHorizontal: 4, marginBottom: 6 }}>{txt}</PText>
  );
  const title = (txt: string, count?: number, sub?: string) => (
    <View style={{ marginTop: 22, marginBottom: 8, marginHorizontal: 4 }}>
      <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15, textAlign: "right" }}>
        {txt}{count != null ? <PText style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 15 }}>{` (${count})`}</PText> : null}
      </PText>
      {sub ? <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13, textAlign: "right", marginTop: 2 }}>{sub}</PText> : null}
    </View>
  );
  const chip = (txt: string, on: boolean, onPress: () => void) => (
    <Pressable key={txt} onPress={onPress}
      style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: on ? t.gold : t.card, borderWidth: 1, borderColor: on ? t.gold : t.border }}>
      <PText style={{ color: on ? t.onGold : t.text2, fontFamily: TJ.bold, fontSize: 14 }}>{txt}</PText>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="chevron-right" size={24} color={t.gold} />
        </Pressable>
        <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 21 }}>تعديل الحساب</PText>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginTop: 6 }}>
          <View>
            <View style={{ width: 148, height: 148, borderRadius: 74, backgroundColor: t.ic, borderWidth: 3, borderColor: t.goldRing, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <PText style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 56 }}>{(name || "؟").trim().charAt(0)}</PText>
              )}
            </View>
            <Pressable onPress={pickPhoto} disabled={uploading}
              style={({ pressed }) => ({ position: "absolute", bottom: 2, left: 2, height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: t.gold, flexDirection: "row-reverse", alignItems: "center", gap: 6, transform: [{ scale: pressed ? 0.95 : 1 }], opacity: uploading ? 0.6 : 1 })}>
              <MaterialCommunityIcons name="pencil" size={15} color={t.onGold} />
              <PText style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 14 }}>{uploading ? "جاري الرفع" : "تعديل"}</PText>
            </Pressable>
          </View>
        </View>

        {title("المعلومات الأساسية")}
        <View style={{ gap: 10 }}>
          <View>{label("الاسم الكامل")}<TextInput value={name} onChangeText={setName} style={input} placeholderTextColor={t.muted} /></View>
          <View style={{ flexDirection: "row-reverse", gap: 10 }}>
            <View style={{ flex: 1.6 }}>{label("رقم الموبايل")}<TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={[input, { writingDirection: "ltr" }]} /></View>
            <View style={{ flex: 1 }}>{label("سنوات الخبرة")}<TextInput value={exp} onChangeText={(v) => setExp(v.replace(/[^\d.]/g, ""))} keyboardType="numeric" style={input} /></View>
          </View>
          <View>
            {label("السعر الأساسي (ج.م) · يظهر للعملاء كسعر بداية")}
            <View style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.ic, paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
              <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15 }}>{price ? `${price} ج.م` : "—"}</PText>
              <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5 }}>أقل سعر في خدماتي وأسعاري (تلقائي)</PText>
            </View>
          </View>
          <View>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginHorizontal: 4, marginBottom: 6 }}>
              <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5 }}>نبذة عنك</PText>
              <Pressable onPress={toggleMic}
                style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 14, backgroundColor: micOn ? t.destructive : t.btn }}>
                <MaterialCommunityIcons name="microphone-outline" size={15} color={micOn ? "#fff" : t.gold} />
                <PText style={{ color: micOn ? "#fff" : t.gold, fontFamily: TJ.bold, fontSize: 13 }}>{micOn ? "جارٍ الاستماع…" : "إملاء صوتي"}</PText>
              </Pressable>
            </View>
            <TextInput value={bio} onChangeText={setBio} multiline numberOfLines={3}
              style={[input, { height: undefined, minHeight: 88, paddingTop: 12, fontSize: 14.5, textAlignVertical: "top" }]} />
          </View>
        </View>

        {grades.length ? (
          <>
            {title("الدرجة", undefined, "مطلوب")}
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
              {grades.map((g) => chip(g, grade === g, () => setGrade(g)))}
            </View>
          </>
        ) : null}

        {isDoctor ? (
          <View style={{ marginTop: 22 }}>
            <SearchableSelect
              label="التخصص"
              hint="مطلوب"
              sheetTitle="اختر التخصص"
              value={specialty ?? ""}
              options={specialties.length > 0 ? specialties.map((x) => x.name) : FALLBACK_SPECIALTIES}
              onChange={(v) => setSpecialty(v)}
              placeholder="اختر تخصصك"
            />
          </View>
        ) : null}

        {title("مناطق التغطية", selectedAreas.length, "المحافظات والمدن المفعّلة من الإدارة")}
        <View style={{ gap: 8 }}>
          {[...groupedAreas.entries()].map(([city, list]) => {
            const open = expandedCities.has(city);
            const sel = list.filter((a) => selectedAreas.includes(a.name)).length;
            const all = sel === list.length;
            return (
              <View key={city} style={{ backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: sel ? t.goldRing : t.border }}>
                <Pressable onPress={() => toggleCity(city)} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 14 }}>
                  <PText style={{ flex: 1, color: t.text, fontFamily: TJ.heavy, fontSize: 15, textAlign: "right" }}>{city}</PText>
                  <View style={{ backgroundColor: sel ? t.gold : t.btn, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 2 }}>
                    <PText style={{ color: sel ? t.onGold : t.muted, fontFamily: TJ.heavy, fontSize: 12.5 }}>{sel}/{list.length}</PText>
                  </View>
                  <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={20} color={t.muted} />
                </Pressable>
                {open ? (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                    <Pressable onPress={() => toggleAllInCity(city, list)}>
                      <PText style={{ color: t.gold, fontFamily: TJ.bold, fontSize: 13.5, textAlign: "right", marginBottom: 10 }}>{all ? "مسح الكل" : "اختيار كل المدن"}</PText>
                    </Pressable>
                    <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
                      {list.map((a) => chip(a.name, selectedAreas.includes(a.name), () => toggleArea(a.name)))}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ backgroundColor: t.nav, borderTopWidth: 1, borderTopColor: t.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) }}>
        <Pressable onPress={handleSave} disabled={saving}
          style={({ pressed }) => ({ borderRadius: 18, paddingVertical: 15, alignItems: "center", backgroundColor: t.gold, opacity: saving ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <PText style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 15.5 }}>{saving ? "جاري الحفظ..." : "حفظ"}</PText>
        </Pressable>
      </View>
      {burst.node}
    </KeyboardAvoidingView>
  );
}
