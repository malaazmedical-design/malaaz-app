import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FieldLabel, PrimaryButton } from "@/components/ui";
import { useProvider } from "@/contexts/ProviderContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

const DARK = "#1C2B2A";
const GOLD = "#C9A84C";

const SERVICE_TYPES = [
  { key: "كشف منزلي", icon: "stethoscope" },
  { key: "تمريض منزلي", icon: "heart-pulse" },
  { key: "أشعة منزلية", icon: "radioactive" },
] as const;

const GRADES = [
  { key: "أخصائي", icon: "school", desc: "خبرة متخصصة" },
  { key: "استشاري", icon: "medal", desc: "أعلى درجة مهنية" },
] as const;

export default function ProviderProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { provider, areas, subServices, saveProfile } = useProvider();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [exp, setExp] = useState("");
  const [bio, setBio] = useState("");
  const [price, setPrice] = useState("");
  const [serviceType, setServiceType] = useState("كشف منزلي");
  const [grade, setGrade] = useState("أخصائي");
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!provider) return;
    setName(provider.name ?? "");
    setPhone(provider.phone ?? "");
    setExp(provider.experience ? String(provider.experience) : "");
    setBio(provider.bio ?? "");
    setPrice(provider.price ? String(provider.price) : "");
    setServiceType(provider.service_type ?? "كشف منزلي");
    setGrade(provider.grade ?? "أخصائي");
    setSpecialty(provider.specialty ?? null);
    setPhotoUrl(provider.photo_url ?? null);
    setSelectedAreas(
      (provider.areas ?? provider.area ?? "").split(",").map((a) => a.trim()).filter(Boolean)
    );
  }, [provider]);

  // تخصصات الكشف المنزلي من sub_services (نفس مصدر الموقع)
  const specialties = useMemo(
    () => subServices.filter((s) => s.service_name === "كشف منزلي" && s.group_name === "specialty"),
    [subServices]
  );

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
        price: price ? parseFloat(price) : null,
        photoUrl,
      });
      Alert.alert("تم", "✅ تم حفظ الملف الشخصي");
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    color: colors.foreground,
    textAlign: "right" as const,
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={{ backgroundColor: DARK, paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 20 }}>
        <Text style={{ color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 18, textAlign: "right" }}>ملفي الشخصي</Text>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right", marginTop: 2 }}>
          المعلومات التي تظهر للعملاء
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        {/* الصورة */}
        <SectionTitle icon="camera" label="الصورة الشخصية" />
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surfaceMuted, borderWidth: 2, borderColor: colors.border, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <MaterialCommunityIcons name="doctor" size={36} color={colors.mutedForeground} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label={uploading ? "جاري الرفع..." : photoUrl ? "تغيير الصورة" : "رفع صورة"}
              icon="upload"
              variant="outline"
              onPress={pickPhoto}
              loading={uploading}
            />
          </View>
        </View>

        {/* المعلومات الأساسية */}
        <SectionTitle icon="account" label="المعلومات الأساسية" />
        <FieldLabel label="الاسم الكامل *" />
        <TextInput style={[inputStyle, { marginBottom: 12 }]} value={name} onChangeText={setName} placeholder="اسمك كاملاً" placeholderTextColor={colors.mutedForeground} />
        <View style={{ flexDirection: "row-reverse", gap: 10, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <FieldLabel label="رقم الموبايل" />
            <TextInput style={inputStyle} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="01xxxxxxxxx" placeholderTextColor={colors.mutedForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <FieldLabel label="سنوات الخبرة" />
            <TextInput style={inputStyle} value={exp} onChangeText={(t) => setExp(t.replace(/[^\d.]/g, ""))} keyboardType="numeric" placeholder="مثال: 10" placeholderTextColor={colors.mutedForeground} />
          </View>
        </View>
        <FieldLabel label="نبذة عنك" />
        <TextInput
          style={[inputStyle, { minHeight: 80, textAlignVertical: "top", marginBottom: 16 }]}
          value={bio} onChangeText={setBio} multiline
          placeholder="اكتب نبذة قصيرة تظهر للعملاء..." placeholderTextColor={colors.mutedForeground}
        />

        {/* نوع الخدمة */}
        <SectionTitle icon="medical-bag" label="نوع الخدمة" />
        <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 16 }}>
          {SERVICE_TYPES.map((st) => {
            const active = serviceType === st.key;
            return (
              <Pressable
                key={st.key}
                onPress={() => setServiceType(st.key)}
                style={{ flex: 1, padding: 12, borderRadius: 12, alignItems: "center", borderWidth: 2, borderColor: active ? GOLD : colors.border, backgroundColor: active ? "rgba(201,168,76,0.06)" : colors.card }}
              >
                <MaterialCommunityIcons name={st.icon as any} size={22} color={active ? GOLD : colors.mutedForeground} />
                <Text style={{ fontSize: 11, fontFamily: "Cairo_700Bold", color: active ? colors.foreground : colors.mutedForeground, marginTop: 4, textAlign: "center" }}>{st.key}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* الدرجة والتخصص — للكشف المنزلي */}
        {serviceType === "كشف منزلي" ? (
          <>
            <SectionTitle icon="medal" label="الدرجة المهنية" />
            <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 12 }}>
              {GRADES.map((g) => {
                const active = grade === g.key;
                return (
                  <Pressable
                    key={g.key}
                    onPress={() => setGrade(g.key)}
                    style={{ flex: 1, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: active ? GOLD : colors.border, backgroundColor: active ? "rgba(201,168,76,0.06)" : colors.card }}
                  >
                    <MaterialCommunityIcons name={g.icon as any} size={20} color={active ? GOLD : colors.mutedForeground} />
                    <Text style={{ fontSize: 13, fontFamily: "Cairo_700Bold", color: colors.foreground, marginTop: 4, textAlign: "right" }}>{g.key}</Text>
                    <Text style={{ fontSize: 10, fontFamily: "Cairo_400Regular", color: colors.mutedForeground, textAlign: "right" }}>{g.desc}</Text>
                  </Pressable>
                );
              })}
            </View>

            <SectionTitle icon="stethoscope" label="التخصص" />
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {specialties.map((s) => {
                const active = specialty === s.name;
                const consultant = grade === "استشاري";
                const min = (consultant ? s.price_min_consultant : s.price_min_specialist) ?? s.price_min ?? 0;
                const max = (consultant ? s.price_max_consultant : s.price_max_specialist) ?? s.price_max ?? 0;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSpecialty(s.name)}
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: active ? GOLD : colors.border, backgroundColor: active ? "rgba(201,168,76,0.1)" : colors.card }}
                  >
                    <Text style={{ fontSize: 12, fontFamily: "Cairo_600SemiBold", color: active ? "#b8860b" : colors.foreground }}>
                      {s.name} <Text style={{ fontSize: 10, color: colors.mutedForeground }}>({min}–{max} ج.م)</Text>
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <>
            <FieldLabel label="التخصص" />
            <TextInput
              style={[inputStyle, { marginBottom: 16 }]}
              value={specialty ?? ""}
              onChangeText={setSpecialty}
              placeholder="مثال: تمريض حالات حرجة"
              placeholderTextColor={colors.mutedForeground}
            />
          </>
        )}

        {/* السعر الأساسي */}
        <FieldLabel label="السعر الأساسي (ج.م)" hint="يظهر للعملاء كسعر بداية" />
        <TextInput style={[inputStyle, { marginBottom: 16 }]} value={price} onChangeText={(t) => setPrice(t.replace(/[^\d.]/g, ""))} keyboardType="numeric" placeholder="مثال: 400" placeholderTextColor={colors.mutedForeground} />

        {/* مناطق الخدمة */}
        <SectionTitle icon="map-marker" label={`مناطق الخدمة (${selectedAreas.length} مختارة)`} />
        <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {areas.map((a) => {
            const active = selectedAreas.includes(a.name);
            return (
              <Pressable
                key={a.id}
                onPress={() => toggleArea(a.name)}
                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: active ? GOLD : colors.border, backgroundColor: active ? "rgba(201,168,76,0.12)" : colors.card }}
              >
                <Text style={{ fontSize: 12, fontFamily: "Cairo_600SemiBold", color: active ? "#b8860b" : colors.mutedForeground }}>
                  {active ? "✓ " : ""}{a.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <PrimaryButton label={saving ? "جاري الحفظ..." : "حفظ الملف الشخصي"} icon="content-save" onPress={handleSave} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionTitle({ icon, label }: { icon: any; label: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <MaterialCommunityIcons name={icon} size={15} color={GOLD} />
      <Text style={{ fontSize: 14, fontFamily: "Cairo_700Bold", color: colors.foreground }}>{label}</Text>
    </View>
  );
}
