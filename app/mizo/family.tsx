import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, Pressable,
  ScrollView, TextInput, Alert, Switch, Modal,
} from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  getFamilyLinks, addFamilyLink, deleteFamilyLink, MizoFamilyLink,
} from "@/lib/mizoStorage";
import { getExpoPushToken } from "@/lib/push";

const RELATIONS = ["أم", "أب", "ابن", "بنت", "زوج/ة", "أخ", "أخت", "جد", "جدة", "ممرض/ة", "دكتور", "أخرى"];

export default function MizoFamilyScreen() {
  const [links, setLinks] = useState<MizoFamilyLink[]>([]);
  const [myToken, setMyToken] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState(RELATIONS[0]);
  const [phone, setPhone] = useState("");
  const [pushToken, setPushToken] = useState("");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getFamilyLinks().then(setLinks);
    getExpoPushToken().then(setMyToken);
  }, []);

  const openAdd = () => {
    setName(""); setRelation(RELATIONS[0]); setPhone("");
    setPushToken(""); setEmergencyOnly(false);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("تنبيه", "اكتب اسم الشخص"); return; }
    if (!phone.trim() && !pushToken.trim()) {
      Alert.alert("تنبيه", "لازم تدخل رقم الموبايل أو توكن الإشعار"); return;
    }
    setSaving(true);
    const newLink = await addFamilyLink({
      family_name: name.trim(),
      relation,
      phone: phone.trim(),
      push_token: pushToken.trim(),
      notify_emergency_only: emergencyOnly,
    });
    setLinks((prev) => [...prev, newLink]);
    setSaving(false);
    setModalVisible(false);
  };

  const handleDelete = (id: string, familyName: string) => {
    Alert.alert("مسح جهة الاتصال", `هتمسح ${familyName}؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "امسح", style: "destructive",
        onPress: async () => {
          await deleteFamilyLink(id);
          setLinks((prev) => prev.filter((l) => l.id !== id));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-right" size={26} color="#C9A84C" />
        </Pressable>
        <Text style={styles.headerTitle}>إشعارات العيلة</Text>
        <Pressable onPress={openAdd} style={styles.addBtn}>
          <MaterialCommunityIcons name="plus" size={26} color="#C9A84C" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* My token section */}
        {myToken && (
          <View style={styles.myTokenBox}>
            <Text style={styles.myTokenTitle}>توكن إشعار جهازك</Text>
            <Text style={styles.myTokenHint}>
              شارك الكود ده مع أهلك عشان يتلقوا إشعارات منك
            </Text>
            <Text style={styles.myTokenText} selectable numberOfLines={2}>{myToken}</Text>
          </View>
        )}

        {/* How it works */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>🔔 إزاي بيشتغل؟</Text>
          <Text style={styles.infoText}>
            لما تضغط على أي كلمة في ميزو، بيوصل إشعار فوري للأهل اللي مسجّلين هنا.
            لو محدد "طوارئ بس" — بيوصلهم إشعار وقت النجدة بس.
          </Text>
          <Text style={styles.infoText}>
            عشان الأهل يتلقوا إشعارات، لازم يكون عندهم تطبيق ملاذ وتدخل توكنهم هنا.
          </Text>
        </View>

        {links.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👨‍👩‍👧</Text>
            <Text style={styles.emptyText}>محدش مضاف لسه</Text>
            <Text style={styles.emptyHint}>اضغط + عشان تضيف فرد من العيلة</Text>
          </View>
        ) : (
          links.map((link) => (
            <View key={link.id} style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{link.family_name}</Text>
                <Text style={styles.cardRelation}>{link.relation}</Text>
                {link.phone ? <Text style={styles.cardDetail}>📞 {link.phone}</Text> : null}
                {link.push_token ? <Text style={styles.cardDetail}>🔔 توكن مسجّل</Text> : null}
                {link.notify_emergency_only && (
                  <View style={styles.emergencyBadge}>
                    <Text style={styles.emergencyBadgeText}>طوارئ بس</Text>
                  </View>
                )}
              </View>
              <Pressable onPress={() => handleDelete(link.id, link.family_name)} style={styles.deleteBtn}>
                <MaterialCommunityIcons name="delete-outline" size={22} color="#CC2200" />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>إضافة فرد من العيلة</Text>

            <Text style={styles.fieldLabel}>الاسم</Text>
            <TextInput
              style={styles.input} value={name} onChangeText={setName}
              placeholder="مثال: أحمد" placeholderTextColor="#9AABAA" textAlign="right"
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

            <Text style={styles.fieldLabel}>رقم الموبايل (اختياري)</Text>
            <TextInput
              style={styles.input} value={phone} onChangeText={setPhone}
              placeholder="01XXXXXXXXX" placeholderTextColor="#9AABAA"
              keyboardType="phone-pad" textAlign="right"
            />

            <Text style={styles.fieldLabel}>توكن الإشعار (اختياري)</Text>
            <TextInput
              style={[styles.input, { fontSize: 12 }]} value={pushToken} onChangeText={setPushToken}
              placeholder="ExponentPushToken[...]" placeholderTextColor="#9AABAA"
              autoCapitalize="none" textAlign="right"
            />

            <View style={styles.switchRow}>
              <Switch
                value={emergencyOnly}
                onValueChange={setEmergencyOnly}
                trackColor={{ false: "#E0E8E7", true: "#1C2B2A" }}
                thumbColor={emergencyOnly ? "#C9A84C" : "#7A8A89"}
              />
              <Text style={styles.switchLabel}>إشعارات الطوارئ بس</Text>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>إلغاء</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveText}>{saving ? "جاري..." : "أضف"}</Text>
              </Pressable>
            </View>
          </View>
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
  addBtn: { padding: 4 },
  body: { padding: 16 },

  myTokenBox: {
    backgroundColor: "#1C2B2A", borderRadius: 16, padding: 14, marginBottom: 14,
  },
  myTokenTitle: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#C9A84C", textAlign: "right", marginBottom: 4 },
  myTokenHint: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#9AABAA", textAlign: "right", marginBottom: 8 },
  myTokenText: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#FFFFFF", textAlign: "right", lineHeight: 18 },

  infoBox: { backgroundColor: "#EDF5F4", borderRadius: 14, padding: 14, marginBottom: 16 },
  infoTitle: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#1C2B2A", textAlign: "right", marginBottom: 6 },
  infoText: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#7A8A89", textAlign: "right", marginBottom: 4, lineHeight: 18 },

  empty: { alignItems: "center", marginTop: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#1C2B2A", marginBottom: 6 },
  emptyHint: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#7A8A89" },

  card: {
    flexDirection: "row-reverse", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: "#E0E8E7",
  },
  cardInfo: { flex: 1 },
  cardName: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#1C2B2A", textAlign: "right" },
  cardRelation: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#7A8A89", textAlign: "right" },
  cardDetail: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#7A8A89", textAlign: "right", marginTop: 2 },
  emergencyBadge: { alignSelf: "flex-end", marginTop: 4, backgroundColor: "#CC220022", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  emergencyBadgeText: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: "#CC2200" },
  deleteBtn: { padding: 8 },

  overlay: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "90%" },
  modalTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#1C2B2A", textAlign: "right", marginBottom: 16 },
  fieldLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#1C2B2A", textAlign: "right", marginBottom: 6 },
  input: {
    backgroundColor: "#F5F7F6", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: "Cairo_400Regular", fontSize: 14, color: "#1C2B2A",
    borderWidth: 1, borderColor: "#E0E8E7", marginBottom: 12,
  },
  relRow: { marginBottom: 12 },
  relChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#E8EDEC", marginLeft: 6 },
  relChipActive: { backgroundColor: "#1C2B2A" },
  relChipText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#1C2B2A" },
  relChipTextActive: { color: "#C9A84C" },
  switchRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 16 },
  switchLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#1C2B2A" },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#E8EDEC" },
  cancelText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#1C2B2A" },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#1C2B2A" },
  saveText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#C9A84C" },
});
