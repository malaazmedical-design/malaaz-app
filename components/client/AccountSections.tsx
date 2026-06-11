import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

const DARK = "#1C2B2A";
const GOLD = "#C9A84C";

// ─── العناوين المحفوظة (زي client.html) ──────────────────────────────────────
export function AddressesSection() {
  const colors = useColors();
  const { addresses, coverageAreas, addAddress, deleteAddress, setDefaultAddress } = useApp();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [areaOpen, setAreaOpen] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!address.trim() || !area) { Alert.alert("تنبيه", "أدخل العنوان واختر المنطقة"); return; }
    setBusy(true);
    try {
      await addAddress(address.trim(), area, isDefault);
      setOpen(false); setAddress(""); setArea(""); setIsDefault(false);
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16 }}>📍 عناويني المحفوظة</Text>
        <Pressable onPress={() => setOpen(true)} style={{ backgroundColor: GOLD, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}>
          <Text style={{ color: DARK, fontFamily: "Cairo_700Bold", fontSize: 12 }}>+ إضافة</Text>
        </Pressable>
      </View>

      {addresses.length === 0 ? (
        <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "center", padding: 14 }}>
          لا توجد عناوين محفوظة — أضف عنوانك الأول!
        </Text>
      ) : (
        addresses.map((a) => (
          <View
            key={a.id}
            style={{
              backgroundColor: a.is_default ? "rgba(201,168,76,0.06)" : colors.card,
              borderWidth: 1.5, borderColor: a.is_default ? "rgba(201,168,76,0.4)" : colors.border,
              borderRadius: 12, padding: 12, marginBottom: 8,
              flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", gap: 8,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 13, textAlign: "right" }}>{a.address}</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 11, textAlign: "right", marginTop: 2 }}>
                <MaterialCommunityIcons name="map-marker" size={10} /> {a.area}
                {a.is_default ? "  ·  ⭐ افتراضي" : ""}
              </Text>
            </View>
            <View style={{ gap: 6 }}>
              {!a.is_default ? (
                <Pressable onPress={() => setDefaultAddress(a.id)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_600SemiBold", fontSize: 10 }}>تعيين افتراضي</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => Alert.alert("حذف", "حذف هذا العنوان؟", [
                  { text: "إلغاء", style: "cancel" },
                  { text: "حذف", style: "destructive", onPress: () => deleteAddress(a.id) },
                ])}
                style={{ backgroundColor: "#FEE2E2", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignItems: "center" }}
              >
                <Text style={{ color: "#DC2626", fontFamily: "Cairo_600SemiBold", fontSize: 10 }}>حذف</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      {/* مودال إضافة عنوان */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={() => setOpen(false)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", marginBottom: 14 }}>إضافة عنوان جديد</Text>

            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="العنوان التفصيلي (الشارع، العمارة، الدور...)"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={{ backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 12, minHeight: 70, textAlign: "right", fontFamily: "Cairo_400Regular", fontSize: 13, color: colors.foreground, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10, textAlignVertical: "top" }}
            />

            <Pressable
              onPress={() => setAreaOpen(true)}
              style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 }}
            >
              <Text style={{ fontFamily: "Cairo_600SemiBold", fontSize: 13, color: area ? colors.foreground : colors.mutedForeground }}>
                {area || "اختر المنطقة"}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={18} color={colors.mutedForeground} />
            </Pressable>

            <Pressable onPress={() => setIsDefault((v) => !v)} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: isDefault ? GOLD : colors.border, backgroundColor: isDefault ? GOLD : "transparent", alignItems: "center", justifyContent: "center" }}>
                {isDefault ? <MaterialCommunityIcons name="check" size={14} color={DARK} /> : null}
              </View>
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_400Regular", fontSize: 13 }}>تعيين كعنوان افتراضي</Text>
            </Pressable>

            <Pressable onPress={save} disabled={busy} style={{ backgroundColor: GOLD, borderRadius: 12, padding: 14, alignItems: "center", opacity: busy ? 0.6 : 1 }}>
              <Text style={{ color: DARK, fontFamily: "Cairo_700Bold", fontSize: 14 }}>{busy ? "جاري الحفظ..." : "حفظ العنوان"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* مودال اختيار المنطقة */}
      <Modal visible={areaOpen} transparent animationType="slide" onRequestClose={() => setAreaOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={() => setAreaOpen(false)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "65%" }}>
            <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
              {coverageAreas.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => { setArea(a.name); setAreaOpen(false); }}
                  style={{ flexDirection: "row-reverse", justifyContent: "space-between", padding: 14, borderRadius: 12, backgroundColor: area === a.name ? "rgba(201,168,76,0.1)" : "transparent" }}
                >
                  <Text style={{ fontFamily: "Cairo_600SemiBold", fontSize: 14, color: area === a.name ? "#b8860b" : colors.foreground }}>{a.name}</Text>
                  <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 12, color: colors.mutedForeground }}>{a.city}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── أفراد العائلة ────────────────────────────────────────────────────────────
const RELATIONS = ["الوالد", "الوالدة", "الزوج/ة", "ابن/ابنة", "أخ/أخت", "آخر"];

export function FamilySection() {
  const colors = useColors();
  const { familyMembers, addFamilyMember, deleteFamilyMember } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) { Alert.alert("تنبيه", "أدخل اسم الفرد"); return; }
    setBusy(true);
    try {
      await addFamilyMember({
        name: name.trim(),
        relation: relation || undefined,
        birthYear: birthYear ? parseInt(birthYear, 10) : undefined,
        notes: notes.trim() || undefined,
      });
      setOpen(false); setName(""); setRelation(""); setBirthYear(""); setNotes("");
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16 }}>👨‍👩‍👧 أفراد العائلة</Text>
        <Pressable onPress={() => setOpen(true)} style={{ backgroundColor: GOLD, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}>
          <Text style={{ color: DARK, fontFamily: "Cairo_700Bold", fontSize: 12 }}>+ إضافة</Text>
        </Pressable>
      </View>

      {familyMembers.length === 0 ? (
        <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "center", padding: 14 }}>
          أضف أفراد عائلتك عشان تحجزلهم بضغطة واحدة
        </Text>
      ) : (
        familyMembers.map((m) => (
          <View key={m.id} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 13, textAlign: "right" }}>
                {m.name}{m.relation ? `  ·  ${m.relation}` : ""}
              </Text>
              {m.birth_year || m.notes ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 11, textAlign: "right", marginTop: 2 }}>
                  {m.birth_year ? `مواليد ${m.birth_year}` : ""}{m.birth_year && m.notes ? " · " : ""}{m.notes ?? ""}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => Alert.alert("حذف", `حذف ${m.name}؟`, [
                { text: "إلغاء", style: "cancel" },
                { text: "حذف", style: "destructive", onPress: () => deleteFamilyMember(m.id) },
              ])}
              style={{ backgroundColor: "#FEE2E2", borderRadius: 8, padding: 6 }}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={16} color="#DC2626" />
            </Pressable>
          </View>
        ))
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={() => setOpen(false)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", marginBottom: 14 }}>إضافة فرد من العائلة</Text>

            <TextInput value={name} onChangeText={setName} placeholder="الاسم *" placeholderTextColor={colors.mutedForeground}
              style={{ backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 12, textAlign: "right", fontFamily: "Cairo_400Regular", fontSize: 13, color: colors.foreground, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 }} />

            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {RELATIONS.map((r) => (
                <Pressable key={r} onPress={() => setRelation(r)}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: relation === r ? GOLD : colors.border, backgroundColor: relation === r ? "rgba(201,168,76,0.12)" : "transparent" }}>
                  <Text style={{ fontSize: 12, fontFamily: "Cairo_600SemiBold", color: relation === r ? "#b8860b" : colors.mutedForeground }}>{r}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput value={birthYear} onChangeText={(t) => setBirthYear(t.replace(/[^\d]/g, ""))} placeholder="سنة الميلاد (اختياري)" placeholderTextColor={colors.mutedForeground} keyboardType="numeric"
              style={{ backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 12, textAlign: "right", fontFamily: "Cairo_400Regular", fontSize: 13, color: colors.foreground, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 }} />

            <TextInput value={notes} onChangeText={setNotes} placeholder="ملاحظات صحية (أمراض مزمنة، حساسية...) — اختياري" placeholderTextColor={colors.mutedForeground} multiline
              style={{ backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 12, minHeight: 60, textAlign: "right", fontFamily: "Cairo_400Regular", fontSize: 13, color: colors.foreground, borderWidth: 1.5, borderColor: colors.border, marginBottom: 14, textAlignVertical: "top" }} />

            <Pressable onPress={save} disabled={busy} style={{ backgroundColor: GOLD, borderRadius: 12, padding: 14, alignItems: "center", opacity: busy ? 0.6 : 1 }}>
              <Text style={{ color: DARK, fontFamily: "Cairo_700Bold", fontSize: 14 }}>{busy ? "جاري الحفظ..." : "حفظ"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
