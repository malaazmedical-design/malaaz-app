import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, Pressable,
  ScrollView, TextInput, Alert, Switch, Modal, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  getFamilyLinks, addFamilyLink, deleteFamilyLink, setPrimaryFamilyLink,
  lookupPushTokenByPhone, MizoFamilyLink, getProfile,
} from "@/lib/mizoStorage";

const RELATIONS = ["أب", "أم", "ابن", "بنت", "زوج", "زوجة", "أخ", "أخت", "جد", "جدة", "ممرض/ة", "أخرى"];

export default function MizoFamilyScreen() {
  const [links, setLinks] = useState<MizoFamilyLink[]>([]);
  const [patientName, setPatientName] = useState("المريض");
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState(RELATIONS[0]);
  const [phone, setPhone] = useState("");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [fetched, profile] = await Promise.all([getFamilyLinks(), getProfile()]);
    setLinks(fetched);
    setPatientName(profile.patientName || "المريض");
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const openAdd = () => {
    setName(""); setRelation(RELATIONS[0]); setPhone("");
    setEmergencyOnly(false); setIsPrimary(false);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("تنبيه", "اكتب اسم الشخص"); return; }
    if (!phone.trim()) { Alert.alert("تنبيه", "لازم تكتب رقم التليفون"); return; }
    setSaving(true);
    const token = await lookupPushTokenByPhone(phone.trim());
    await addFamilyLink({
      family_name: name.trim(),
      relation,
      phone: phone.trim(),
      push_token: token ?? "",
      notify_emergency_only: emergencyOnly,
      is_primary: isPrimary,
    });
    setSaving(false);
    setModalVisible(false);
    await refresh();

    if (token) {
      Alert.alert("تم ✅", `${name.trim()} عنده التطبيق — هيوصله الإشعار لحظياً`);
    } else {
      Alert.alert(
        "تم الحفظ ⚠️",
        `${name.trim()} مش عنده التطبيق دلوقتي.\nلما ينزّل ملاذ ويسجّل بنفس الرقم، الإشعارات هتبدأ تلقائياً.`,
      );
    }
  };

  const handleDelete = (link: MizoFamilyLink) => {
    Alert.alert("مسح", `هتمسح ${link.family_name} من إشعارات العيلة؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "امسح", style: "destructive",
        onPress: async () => {
          await deleteFamilyLink(link.id);
          await refresh();
        },
      },
    ]);
  };

  const handleSetPrimary = async (link: MizoFamilyLink) => {
    await setPrimaryFamilyLink(link.id);
    await refresh();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-right" size={26} color="#C9A84C" />
        </Pressable>
        <Text style={styles.headerTitle}>إشعارات العيلة</Text>
        <Pressable onPress={openAdd} style={styles.headerAddBtn}>
          <MaterialCommunityIcons name="plus" size={26} color="#C9A84C" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* How it works */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>🔔 إزاي بيشتغل؟</Text>
          <Text style={styles.infoText}>
            ١. أضيف أهل {patientName} بأرقامهم هنا{"\n"}
            ٢. لازم يكونوا نازّلين ملاذ على موبايلهم{"\n"}
            ٣. ⭐ المسؤول — هيجيله إشعار لما {patientName} يقول أي كلمة{"\n"}
            ٤. باقي العيلة بيجيلهم النجدة والـ Buzzer بس
          </Text>
        </View>

        <Text style={styles.sectionLabel}>أفراد العيلة</Text>

        {loading ? (
          <ActivityIndicator color="#C9A84C" style={{ marginVertical: 24 }} />
        ) : links.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👨‍👩‍👧</Text>
            <Text style={styles.emptyText}>محدش مضاف لسه</Text>
            <Text style={styles.emptyHint}>اضغط + عشان تضيف فرد من العيلة</Text>
          </View>
        ) : (
          links.map((link) => (
            <View key={link.id} style={[styles.card, link.is_primary && styles.cardPrimary]}>
              {link.is_primary && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>⭐ مسؤول رئيسي</Text>
                </View>
              )}
              <View style={styles.cardRow}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{link.family_name}</Text>
                  <Text style={styles.cardRelation}>{link.relation}</Text>
                  {!!link.phone && <Text style={styles.cardDetail}>📞 {link.phone}</Text>}
                  {link.notify_emergency_only && (
                    <View style={styles.emergencyBadge}>
                      <Text style={styles.emergencyBadgeText}>🚨 طوارئ بس</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardStatusCol}>
                  {link.push_token ? (
                    <View style={styles.tokenOkBadge}>
                      <MaterialCommunityIcons name="check-circle" size={14} color="#2E7D6B" />
                      <Text style={styles.tokenOkText}>عنده التطبيق</Text>
                    </View>
                  ) : (
                    <View style={styles.tokenMissingBadge}>
                      <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#B85C1A" />
                      <Text style={styles.tokenMissingText}>مش عنده</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.cardActions}>
                {!link.is_primary && (
                  <Pressable style={styles.starBtn} onPress={() => handleSetPrimary(link)}>
                    <MaterialCommunityIcons name="star-outline" size={15} color="#C9A84C" />
                    <Text style={styles.starBtnText}>عيّنه مسؤول</Text>
                  </Pressable>
                )}
                <Pressable style={styles.deleteBtn} onPress={() => handleDelete(link)}>
                  <MaterialCommunityIcons name="trash-can-outline" size={15} color="#CC2200" />
                  <Text style={styles.deleteBtnText}>حذف</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Pressable style={styles.addBtn} onPress={openAdd}>
          <MaterialCommunityIcons name="plus" size={18} color="#C9A84C" />
          <Text style={styles.addBtnText}>إضافة فرد من العيلة</Text>
        </Pressable>
      </ScrollView>

      {/* Add modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <ScrollView style={styles.modal} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>إضافة فرد من العيلة</Text>

            <Text style={styles.fieldLabel}>الاسم *</Text>
            <TextInput
              style={styles.input} value={name} onChangeText={setName}
              placeholder="مثال: محمد" placeholderTextColor="#9AABAA" textAlign="right"
            />

            <Text style={styles.fieldLabel}>الصلة</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relRow}>
              {RELATIONS.map((r) => (
                <Pressable
                  key={r}
                  style={[styles.relChip, relation === r && styles.relChipActive]}
                  onPress={() => setRelation(r)}
                >
                  <Text style={[styles.relChipText, relation === r && styles.relChipTextActive]}>{r}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>رقم الموبايل *</Text>
            <TextInput
              style={styles.input} value={phone} onChangeText={setPhone}
              placeholder="01XXXXXXXXX" placeholderTextColor="#9AABAA"
              keyboardType="phone-pad" textAlign="right"
            />
            <Text style={styles.fieldHint}>نفس الرقم المسجّل في تطبيق ملاذ على موبايله</Text>

            <View style={styles.switchRow}>
              <Switch
                value={isPrimary}
                onValueChange={setIsPrimary}
                trackColor={{ false: "#E0E8E7", true: "#1C2B2A" }}
                thumbColor={isPrimary ? "#C9A84C" : "#7A8A89"}
              />
              <Text style={styles.switchLabel}>⭐ عيّنه مسؤول رئيسي</Text>
            </View>
            <Text style={styles.fieldHint}>المسؤول بيوصله إشعار لما {patientName} يقول أي كلمة</Text>

            <View style={[styles.switchRow, { marginTop: 14 }]}>
              <Switch
                value={emergencyOnly}
                onValueChange={setEmergencyOnly}
                trackColor={{ false: "#E0E8E7", true: "#1C2B2A" }}
                thumbColor={emergencyOnly ? "#C9A84C" : "#7A8A89"}
              />
              <Text style={styles.switchLabel}>🚨 طوارئ ونجدة بس</Text>
            </View>
            <Text style={styles.fieldHint}>الكلام العادي مش هيوصله — الطوارئ دايماً بتوصل</Text>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>إلغاء</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#1C2B2A" />
                  : <Text style={styles.saveText}>حفظ</Text>}
              </Pressable>
            </View>
            {saving && (
              <Text style={styles.lookingUp}>🔍 بنبحث عن التطبيق على تليفونه...</Text>
            )}
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7F6" },
  header: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#1C2B2A",
  },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#C9A84C" },
  backBtn: { padding: 4 },
  headerAddBtn: { padding: 4 },
  body: { padding: 16, paddingBottom: 40 },

  infoBox: { backgroundColor: "#EDF5F4", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#C9E0DC" },
  infoTitle: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#1C2B2A", textAlign: "right", marginBottom: 6 },
  infoText: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#3A5A55", textAlign: "right", lineHeight: 20 },

  sectionLabel: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#1C2B2A", textAlign: "right", marginBottom: 10 },

  empty: { alignItems: "center", marginTop: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#1C2B2A", marginBottom: 6 },
  emptyHint: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#7A8A89" },

  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: "#E0E8E7",
  },
  cardPrimary: { borderColor: "#C9A84C", backgroundColor: "#FDFAF3" },
  primaryBadge: {
    alignSelf: "flex-end", backgroundColor: "#FFF3CC", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
  },
  primaryBadgeText: { fontFamily: "Cairo_700Bold", fontSize: 11, color: "#8A6A00" },
  cardRow: { flexDirection: "row-reverse", justifyContent: "space-between" },
  cardInfo: { flex: 1 },
  cardName: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#1C2B2A", textAlign: "right" },
  cardRelation: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#7A8A89", textAlign: "right", marginTop: 2 },
  cardDetail: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#7A8A89", textAlign: "right", marginTop: 2 },
  emergencyBadge: { alignSelf: "flex-end", marginTop: 6, backgroundColor: "#CC220018", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  emergencyBadgeText: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: "#CC2200" },
  cardStatusCol: { alignItems: "flex-start", paddingTop: 2 },
  tokenOkBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#EEF8F3", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  tokenOkText: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#2E7D6B" },
  tokenMissingBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FFF3EC", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  tokenMissingText: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#B85C1A" },
  cardActions: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  starBtn: {
    flexDirection: "row-reverse", alignItems: "center", gap: 4,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8,
    backgroundColor: "#FDFAF3", borderWidth: 1, borderColor: "#C9A84C",
  },
  starBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#C9A84C" },
  deleteBtn: {
    flexDirection: "row-reverse", alignItems: "center", gap: 4,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8,
    backgroundColor: "#FFF5F5", borderWidth: 1, borderColor: "#FFCCCC",
  },
  deleteBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#CC2200" },

  addBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14, marginTop: 6,
    borderWidth: 1.5, borderColor: "#C9A84C", borderStyle: "dashed", backgroundColor: "#FDFAF3",
  },
  addBtnText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#C9A84C" },

  overlay: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  modal: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: "90%",
  },
  modalTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#1C2B2A", textAlign: "right", marginBottom: 16 },
  fieldLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#1C2B2A", textAlign: "right", marginBottom: 6 },
  input: {
    backgroundColor: "#F5F7F6", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: "Cairo_400Regular", fontSize: 14, color: "#1C2B2A",
    borderWidth: 1, borderColor: "#E0E8E7", marginBottom: 4,
  },
  fieldHint: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#9AABAA", textAlign: "right", marginBottom: 12 },
  relRow: { marginBottom: 12 },
  relChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#E8EDEC", marginLeft: 6 },
  relChipActive: { backgroundColor: "#1C2B2A" },
  relChipText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#1C2B2A" },
  relChipTextActive: { color: "#C9A84C" },
  switchRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  switchLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#1C2B2A" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#E8EDEC" },
  cancelText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#1C2B2A" },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#C9A84C" },
  saveText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#1C2B2A" },
  lookingUp: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#7A8A89", textAlign: "center", marginTop: 8 },
});
