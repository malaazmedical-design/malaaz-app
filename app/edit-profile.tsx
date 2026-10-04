import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddressesSection } from "@/components/client/AccountSections";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { useApp } from "@/contexts/AppContext";

export default function EditProfileScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { profile, client, updateProfile } = useApp();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const base = {
    name: profile.name || client?.name || "",
    whatsapp: profile.whatsapp ?? "",
    phone2: profile.phone2 ?? "",
    notes: profile.notes ?? "",
    birthDate: profile.birthDate ?? "",
    gender: (profile.gender ?? "") as "" | "male" | "female",
  };
  const [name, setName] = useState(base.name);
  const [whatsapp, setWhatsapp] = useState(base.whatsapp);
  const [phone2, setPhone2] = useState(base.phone2);
  const [notes, setNotes] = useState(base.notes);
  const [birthDate, setBirthDate] = useState(base.birthDate);
  const [gender, setGender] = useState(base.gender);
  const [avatarUri, setAvatarUri] = useState(profile.avatarUri ?? "");
  const [saving, setSaving] = useState(false);

  // the client record can arrive after first render (e.g. app cold start on this screen)
  useEffect(() => { if (!name && base.name) setName(base.name); }, [base.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = name !== base.name || whatsapp !== base.whatsapp || phone2 !== base.phone2 || notes !== base.notes || birthDate !== base.birthDate || gender !== base.gender;
  const phone = client?.phone || profile.phone;

  // Upload the picked photo straight away (same storage path/policy as before).
  const pickAvatar = async () => {
    if (!client?.id || Platform.OS === "web") {
      Alert.alert("تنبيه", "يجب تسجيل الدخول من التطبيق لإضافة صورة");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const previous = avatarUri;
    setAvatarUri(asset.uri);
    try {
      const { supabase: sb } = await import("@/lib/supabase");
      const ext = asset.uri.split(".").pop()?.toLowerCase().replace(/[^a-z]/g, "") || "jpg";
      const path = `${client.id}/avatar.${ext}`;
      const blob = await (await fetch(asset.uri)).blob();
      const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const { error } = await sb.storage.from("avatars").upload(path, blob, { upsert: true, contentType });
      if (error) throw error;
      const { data } = sb.storage.from("avatars").getPublicUrl(path);
      if (data?.publicUrl) {
        const url = `${data.publicUrl}?t=${Date.now()}`;
        setAvatarUri(url);
        updateProfile({ avatarUri: url });
      }
    } catch {
      setAvatarUri(previous);
      Alert.alert("خطأ", "تعذّر رفع الصورة، حاول مرة أخرى");
    }
  };

  const save = async () => {
    if (!name.trim()) { Alert.alert("تنبيه", "أدخل الاسم"); return; }
    const wa = whatsapp.trim();
    if (wa && !/^01[0125]\d{8}$/.test(wa)) { Alert.alert("تنبيه", "رقم الواتساب غير صحيح (مثال: 01012345678)"); return; }
    if (birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(Date.parse(birthDate)) || new Date(birthDate) > new Date())) {
      Alert.alert("تنبيه", "تاريخ الميلاد غير صحيح (مثال: 1990-05-23)");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        whatsapp: wa || undefined,
        phone2: phone2.trim() || undefined,
        notes: notes.trim(),
        birthDate: birthDate || undefined,
        gender: gender || undefined,
      });
      router.back();
    } catch {
      Alert.alert("خطأ", "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const label = (text: string, optional?: boolean) => (
    <Text style={{ color: t.text, fontFamily: TJ.bold, fontSize: 14, textAlign: "right", marginBottom: 8 }}>
      {text}{optional ? <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12 }}> (اختياري)</Text> : null}
    </Text>
  );
  const field = { backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.border, paddingHorizontal: 14, height: 54, color: t.text, fontFamily: TJ.medium, fontSize: 14, textAlign: "right" as const };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: insets.top + 12 + webTopInset, paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="رجوع" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="arrow-right" size={22} color={t.text} />
        </Pressable>
        <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 22 }}>تعديل الملف</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 130 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Photo */}
        <View style={{ alignItems: "center" }}>
          <Pressable onPress={pickAvatar} accessibilityLabel="تغيير الصورة">
            <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 2.5, borderColor: t.gold, backgroundColor: t.ic, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <Text style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 36 }}>{(name.trim()[0] ?? "م").toUpperCase()}</Text>
              )}
            </View>
            <View style={{ position: "absolute", bottom: 0, left: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: t.gold, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: t.bg }}>
              <MaterialCommunityIcons name="pencil" size={14} color={t.onGold} />
            </View>
          </Pressable>
          <Text style={{ color: t.gold, fontFamily: TJ.bold, fontSize: 13, marginTop: 8 }}>تغيير الصورة</Text>
        </View>

        <View>
          {label("الاسم الكامل")}
          <TextInput value={name} onChangeText={setName} placeholder="مثال: محمد أحمد" placeholderTextColor={t.muted} style={field} />
        </View>

        <View>
          {label("رقم الموبايل")}
          <View style={[field, { backgroundColor: t.ic, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }]}>
            <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, writingDirection: "ltr" }}>{phone || "—"}</Text>
            <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12 }}>للقراءة فقط</Text>
          </View>
        </View>

        <View>
          {label("رقم الواتساب", true)}
          <TextInput value={whatsapp} onChangeText={(v) => setWhatsapp(v.replace(/[^\d]/g, "").slice(0, 11))} placeholder="01xxxxxxxxx" placeholderTextColor={t.muted} keyboardType="number-pad" style={field} />
        </View>

        <View>
          {label("رقم اتصال إضافي", true)}
          <TextInput value={phone2} onChangeText={(v) => setPhone2(v.replace(/[^\d]/g, "").slice(0, 11))} placeholder="01xxxxxxxxx" placeholderTextColor={t.muted} keyboardType="number-pad" style={field} />
        </View>

        {client ? <AddressesSection /> : null}

        <View style={{ flexDirection: "row-reverse", gap: 12 }}>
          <View style={{ flex: 1 }}>
            {label("تاريخ الميلاد", true)}
            <TextInput
              value={birthDate}
              onChangeText={(v) => setBirthDate(v.replace(/[^\d-]/g, "").slice(0, 10))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={t.muted}
              keyboardType="numbers-and-punctuation"
              style={[field, { textAlign: "center", writingDirection: "ltr" }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            {label("النوع", true)}
            <View style={{ flexDirection: "row-reverse", gap: 8 }}>
              {([["male", "ذكر"], ["female", "أنثى"]] as const).map(([k, text]) => {
                const active = gender === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setGender(active ? "" : k)}
                    style={{ flex: 1, height: 54, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center", backgroundColor: active ? t.goldTint : t.card, borderColor: active ? t.gold : t.border }}
                  >
                    <Text style={{ color: active ? t.gold : t.text, fontFamily: TJ.bold, fontSize: 14 }}>{text}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View>
          {label("ملاحظات طبية", true)}
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="حساسية، أمراض مزمنة، أدوية..."
            placeholderTextColor={t.muted}
            multiline
            textAlignVertical="top"
            style={[field, { height: 110, paddingTop: 14 }]}
          />
        </View>
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: insets.bottom + 16, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.border }}>
        <Pressable
          onPress={save}
          disabled={!changed || saving}
          style={{ height: 54, borderRadius: 16, backgroundColor: t.gold, alignItems: "center", justifyContent: "center", opacity: changed && !saving ? 1 : 0.45 }}
        >
          <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 17 }}>{saving ? "جاري الحفظ..." : "حفظ التعديلات"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
