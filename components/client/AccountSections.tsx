import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TJ, useMalaz } from "@/constants/malazTheme";
import { useApp } from "@/contexts/AppContext";
import { matchCoverageArea } from "@/lib/areaMatch";
import { digitsOnly } from "@/lib/digits";

type T = ReturnType<typeof useMalaz>;

function SectionHeader({ t, title, onAdd }: { t: T; title: string; onAdd: () => void }) {
  return (
    <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 16 }}>{title}</Text>
      <Pressable onPress={onAdd} style={{ backgroundColor: t.gold, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 }}>
        <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 13 }}>+ إضافة</Text>
      </Pressable>
    </View>
  );
}

function Sheet({ t, visible, onClose, title, children }: {
  t: T; visible: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,.45)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ backgroundColor: t.hdr, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, paddingBottom: insets.bottom + 24 }}>
          <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 19, textAlign: "right", marginBottom: 14 }}>{title}</Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const inputStyle = (t: T) => ({
  backgroundColor: t.bg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, textAlign: "right" as const,
  fontFamily: TJ.medium, fontSize: 14, color: t.text, borderWidth: 1, borderColor: t.border, marginBottom: 10,
});

// ─── العناوين المحفوظة ───────────────────────────────────────────────────────
export function AddressesSection() {
  const t = useMalaz();
  const { addresses, coverageAreas, addAddress, deleteAddress, setDefaultAddress } = useApp();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [areaOpen, setAreaOpen] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  const reset = () => { setOpen(false); setAddress(""); setArea(""); setIsDefault(false); };

  const save = async () => {
    if (!address.trim() || !area) { Alert.alert("تنبيه", "أدخل العنوان واختر المنطقة"); return; }
    setBusy(true);
    try {
      await addAddress(address.trim(), area, isDefault);
      reset();
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  // Fills the address from the device location and, when it matches a coverage area, the area too.
  const locate = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("denied");
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [geo] = await Location.reverseGeocodeAsync(loc.coords);
      const label = [geo.street, geo.district, geo.city].filter(Boolean).join("، ");
      if (label) setAddress(label);
      const match = matchCoverageArea(
        [geo.district, geo.subregion, geo.name, geo.street, geo.city, geo.region],
        coverageAreas,
      );
      if (match) {
        setArea(match.name);
      } else {
        // couldn't tell the area from the location — let the user pick it right away
        setAreaOpen(true);
      }
    } catch {
      Alert.alert("تنبيه", "اسمح بالوصول للموقع وحاول تاني");
    } finally {
      setLocating(false);
    }
  };

  return (
    <View>
      <SectionHeader t={t} title="العناوين المحفوظة" onAdd={() => setOpen(true)} />
      {addresses.length === 0 ? (
        <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13, textAlign: "center", padding: 14 }}>
          لا توجد عناوين محفوظة. أضف عنوانك الأول
        </Text>
      ) : (
        addresses.map((a) => (
          <View
            key={a.id}
            style={{
              backgroundColor: a.is_default ? t.goldTint : t.card, borderWidth: 1, borderColor: a.is_default ? t.gold : t.border,
              borderRadius: 16, padding: 12, marginBottom: 8, flexDirection: "row-reverse", alignItems: "center", gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontFamily: TJ.bold, fontSize: 13.5, textAlign: "right" }}>{a.address}</Text>
              <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12, textAlign: "right", marginTop: 2 }}>
                {a.area}{a.is_default ? "  ·  افتراضي" : ""}
              </Text>
            </View>
            {!a.is_default ? (
              <Pressable onPress={() => setDefaultAddress(a.id)} style={{ borderWidth: 1, borderColor: t.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: t.muted, fontFamily: TJ.bold, fontSize: 11 }}>تعيين افتراضي</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => Alert.alert("حذف", "حذف هذا العنوان؟", [
                { text: "إلغاء", style: "cancel" },
                { text: "حذف", style: "destructive", onPress: () => deleteAddress(a.id) },
              ])}
              accessibilityLabel="حذف العنوان"
              style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(229,72,77,.14)", alignItems: "center", justifyContent: "center" }}
            >
              <MaterialCommunityIcons name="close" size={16} color={t.destructive} />
            </Pressable>
          </View>
        ))
      )}

      <Sheet t={t} visible={open} onClose={reset} title="إضافة عنوان">
        <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 10 }}>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="الشارع، رقم المبنى، المنطقة"
            placeholderTextColor={t.muted}
            style={[inputStyle(t), { flex: 1, marginBottom: 0 }]}
          />
          <Pressable
            onPress={locate}
            disabled={locating}
            style={{ height: 48, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, borderColor: t.gold, flexDirection: "row-reverse", alignItems: "center", gap: 5 }}
          >
            {locating ? <ActivityIndicator size="small" color={t.gold} /> : <MaterialCommunityIcons name="crosshairs-gps" size={16} color={t.gold} />}
            <Text style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 13 }}>{locating ? "جاري..." : "موقعي"}</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => setAreaOpen(true)}
          style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", backgroundColor: t.bg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: t.border, marginBottom: 10 }}
        >
          <Text style={{ fontFamily: TJ.bold, fontSize: 14, color: area ? t.text : t.muted }}>{area || "اختر المنطقة"}</Text>
          <MaterialCommunityIcons name="chevron-down" size={18} color={t.muted} />
        </Pressable>
        <Pressable onPress={() => setIsDefault((v) => !v)} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: isDefault ? t.gold : t.border, backgroundColor: isDefault ? t.gold : "transparent", alignItems: "center", justifyContent: "center" }}>
            {isDefault ? <MaterialCommunityIcons name="check" size={14} color={t.onGold} /> : null}
          </View>
          <Text style={{ color: t.text, fontFamily: TJ.medium, fontSize: 13.5 }}>تعيين كعنوان افتراضي</Text>
        </Pressable>
        <Pressable onPress={save} disabled={busy || !address.trim()} style={{ height: 50, backgroundColor: t.gold, borderRadius: 16, alignItems: "center", justifyContent: "center", opacity: busy || !address.trim() ? 0.45 : 1 }}>
          <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 15 }}>{busy ? "جاري الحفظ..." : "حفظ"}</Text>
        </Pressable>
      </Sheet>

      <Sheet t={t} visible={areaOpen} onClose={() => setAreaOpen(false)} title="اختر المنطقة">
        <ScrollView style={{ maxHeight: 360 }}>
          {coverageAreas.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => { setArea(a.name); setAreaOpen(false); }}
              style={{ flexDirection: "row-reverse", justifyContent: "space-between", padding: 14, borderRadius: 14, backgroundColor: area === a.name ? t.goldTint : "transparent" }}
            >
              <Text style={{ fontFamily: TJ.bold, fontSize: 14.5, color: area === a.name ? t.gold : t.text }}>{a.name}</Text>
              <Text style={{ fontFamily: TJ.medium, fontSize: 12.5, color: t.muted }}>{a.city}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

// ─── أفراد العائلة ────────────────────────────────────────────────────────────
const RELATIONS = ["الوالد", "الوالدة", "الزوج/ة", "ابن/ابنة", "أخ/أخت", "آخر"];

export function FamilySection() {
  const t = useMalaz();
  const { familyMembers, addFamilyMember, deleteFamilyMember, updateFamilyMember } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const close = () => { setOpen(false); setEditingId(null); setName(""); setRelation(""); setBirthYear(""); setNotes(""); };

  const openEdit = (m: (typeof familyMembers)[0]) => {
    setEditingId(m.id);
    setName(m.name);
    setRelation(m.relation ?? "");
    setBirthYear(m.birth_year ? String(m.birth_year) : "");
    setNotes(m.notes ?? "");
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) { Alert.alert("تنبيه", "أدخل اسم الفرد"); return; }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        relation: relation || undefined,
        birthYear: birthYear ? parseInt(birthYear, 10) : undefined,
        notes: notes.trim() || undefined,
      };
      if (editingId) await updateFamilyMember(editingId, payload);
      else await addFamilyMember(payload);
      close();
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <SectionHeader t={t} title="أفراد العائلة" onAdd={() => setOpen(true)} />
      {familyMembers.length === 0 ? (
        <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13, textAlign: "center", padding: 14 }}>
          أضف أفراد عائلتك عشان تحجزلهم بضغطة واحدة
        </Text>
      ) : (
        <View style={{ backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.border, overflow: "hidden" }}>
          {familyMembers.map((m, i) => (
            <Pressable
              key={m.id}
              onPress={() => router.push(`/family/${m.id}`)}
              style={({ pressed }) => ({
                flexDirection: "row-reverse", alignItems: "center", gap: 10, padding: 14,
                borderBottomWidth: i === familyMembers.length - 1 ? 0 : 1, borderBottomColor: t.border,
                backgroundColor: pressed ? t.ic : "transparent",
              })}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 14.5, textAlign: "right" }}>
                  {m.name}{m.relation ? `  ·  ${m.relation}` : ""}
                </Text>
                <Text style={{ color: t.gold, fontFamily: TJ.medium, fontSize: 12, textAlign: "right", marginTop: 2 }}>
                  الملف الطبي والأدوية
                </Text>
              </View>
              <Pressable onPress={() => openEdit(m)} accessibilityLabel="تعديل" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.ic, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="pencil-outline" size={16} color={t.gold} />
              </Pressable>
              <Pressable
                onPress={() => Alert.alert("حذف", `حذف ${m.name}؟`, [
                  { text: "إلغاء", style: "cancel" },
                  { text: "حذف", style: "destructive", onPress: () => deleteFamilyMember(m.id) },
                ])}
                accessibilityLabel="حذف"
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(229,72,77,.14)", alignItems: "center", justifyContent: "center" }}
              >
                <MaterialCommunityIcons name="close" size={16} color={t.destructive} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}

      <Sheet t={t} visible={open} onClose={close} title={editingId ? "تعديل بيانات الفرد" : "إضافة فرد من العائلة"}>
        <TextInput value={name} onChangeText={setName} placeholder="الاسم (مثال: ماما)" placeholderTextColor={t.muted} style={inputStyle(t)} />
        <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {RELATIONS.map((r) => (
            <Pressable key={r} onPress={() => setRelation(r)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: relation === r ? t.gold : t.border, backgroundColor: relation === r ? t.goldTint : t.card }}>
              <Text style={{ fontSize: 13, fontFamily: TJ.bold, color: relation === r ? t.gold : t.text }}>{r}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={birthYear} onChangeText={(v) => setBirthYear(digitsOnly(v, 4))} placeholder="سنة الميلاد (اختياري)" placeholderTextColor={t.muted} keyboardType="numeric" style={inputStyle(t)} />
        <TextInput value={notes} onChangeText={setNotes} placeholder="ملاحظات صحية (أمراض مزمنة، حساسية...) — اختياري" placeholderTextColor={t.muted} multiline style={[inputStyle(t), { minHeight: 64, textAlignVertical: "top" }]} />
        <Pressable onPress={save} disabled={busy || !name.trim()} style={{ height: 50, backgroundColor: t.gold, borderRadius: 16, alignItems: "center", justifyContent: "center", opacity: busy || !name.trim() ? 0.45 : 1 }}>
          <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 15 }}>{busy ? "جاري الحفظ..." : "حفظ"}</Text>
        </Pressable>
      </Sheet>
    </View>
  );
}
