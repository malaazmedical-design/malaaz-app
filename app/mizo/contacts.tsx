import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, Pressable,
  ScrollView, TextInput, Alert, Modal, Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  getContacts, addContact, updateContact, deleteContact,
  MizoContact, ContactNotifyMode,
} from "@/lib/mizoStorage";

const RELATIONS = ["بابا", "ماما", "ابن", "بنت", "زوج", "زوجة", "أخ", "أخت", "جد", "جدة", "ممرض", "دكتور", "صاحب", "أخرى"];

type NotifyOption = { mode: ContactNotifyMode; label: string; desc: string };
const NOTIFY_OPTIONS: NotifyOption[] = [
  { mode: "all",            label: "كل الإشعارات",   desc: "بيوصله كل حاجه باباه بقولها" },
  { mode: "emergency_only", label: "الطوارئ بس",     desc: "بس وقت الطوارئ" },
  { mode: "direct_only",    label: "وقت ضغط بطاقته", desc: "بس لما باباه يضغط على بطاقته" },
];

export default function MizoContactsScreen() {
  const [contacts, setContacts] = useState<MizoContact[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState(RELATIONS[0]);
  const [phrase, setPhrase] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [pushToken, setPushToken] = useState("");
  const [notifyMode, setNotifyMode] = useState<ContactNotifyMode>("direct_only");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getContacts().then(setContacts);
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setName(""); setRelation(RELATIONS[0]);
    setPhrase(""); setPhoto(null);
    setPushToken(""); setNotifyMode("direct_only");
    setModalVisible(true);
  };

  const openEdit = (c: MizoContact) => {
    setEditingId(c.id);
    setName(c.name); setRelation(c.relation);
    setPhrase(c.phrase); setPhoto(c.photo);
    setPushToken(c.push_token ?? ""); setNotifyMode(c.notify_mode ?? "direct_only");
    setModalVisible(true);
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("تنبيه", "محتاج صلاحية الوصول للصور"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images", allowsEditing: true, aspect: [1, 1], quality: 0.25, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("تنبيه", "محتاج صلاحية الكاميرا"); return; }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [1, 1], quality: 0.25, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const autoPhrase = (n: string, r: string) => `نادوا على ${r} ${n}`.trim();

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("تنبيه", "اكتب الاسم"); return; }
    setSaving(true);
    const finalPhrase = phrase.trim() || autoPhrase(name.trim(), relation);
    const token = pushToken.trim() || undefined;
    if (editingId) {
      await updateContact(editingId, {
        name: name.trim(), relation, phrase: finalPhrase, photo,
        push_token: token, notify_mode: token ? notifyMode : undefined,
      });
      setContacts((prev) => prev.map((c) => c.id === editingId
        ? { ...c, name: name.trim(), relation, phrase: finalPhrase, photo, push_token: token, notify_mode: token ? notifyMode : undefined }
        : c));
    } else {
      const c = await addContact({
        name: name.trim(), relation, phrase: finalPhrase, photo,
        push_token: token, notify_mode: token ? notifyMode : undefined,
      });
      setContacts((prev) => [...prev, c]);
    }
    setSaving(false);
    setModalVisible(false);
  };

  const handleDelete = (id: string, cname: string) => {
    Alert.alert("مسح", `هتمسح ${cname}؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "امسح", style: "destructive",
        onPress: async () => { await deleteContact(id); setContacts((prev) => prev.filter((c) => c.id !== id)); },
      },
    ]);
  };

  const notifyLabel = (c: MizoContact) => {
    if (!c.push_token) return null;
    const opt = NOTIFY_OPTIONS.find((o) => o.mode === (c.notify_mode ?? "direct_only"));
    return opt?.label ?? "";
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-right" size={26} color="#C9A84C" />
        </Pressable>
        <Text style={styles.headerTitle}>عيلتي</Text>
        <Pressable onPress={openAdd} style={styles.addBtn}>
          <MaterialCommunityIcons name="plus" size={26} color="#C9A84C" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.hint}>
          البطاقات دي بتظهر في قائمة "العيلة" في ميزو — لو ضيفت توكن الجهاز هيوصله إشعار على طول
        </Text>

        {contacts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👨‍👩‍👧‍👦</Text>
            <Text style={styles.emptyText}>محدش مضاف لسه</Text>
            <Pressable style={styles.emptyBtn} onPress={openAdd}>
              <Text style={styles.emptyBtnText}>+ أضف أول شخص</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.grid}>
            {contacts.map((c) => {
              const nb = notifyLabel(c);
              return (
                <Pressable key={c.id} style={styles.card} onPress={() => openEdit(c)} onLongPress={() => handleDelete(c.id, c.name)}>
                  {c.photo ? (
                    <Image source={{ uri: c.photo }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: c.color }]}>
                      <Text style={styles.avatarInitial}>{c.name[0]}</Text>
                    </View>
                  )}
                  <Text style={styles.cardName} numberOfLines={2}>{c.name}</Text>
                  <Text style={styles.cardRelation}>{c.relation}</Text>
                  {nb && (
                    <View style={styles.notifyBadge}>
                      <MaterialCommunityIcons name="bell-outline" size={10} color="#1C6B3A" />
                      <Text style={styles.notifyBadgeText}>{nb}</Text>
                    </View>
                  )}
                  <Pressable style={styles.editIcon} onPress={() => openEdit(c)}>
                    <MaterialCommunityIcons name="pencil" size={14} color="#7A8A89" />
                  </Pressable>
                </Pressable>
              );
            })}
            <Pressable style={styles.addCard} onPress={openAdd}>
              <MaterialCommunityIcons name="plus" size={32} color="#C9A84C" />
              <Text style={styles.addCardText}>أضف شخص</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>{editingId ? "تعديل" : "إضافة شخص"}</Text>

              {/* Photo picker */}
              <View style={styles.photoRow}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.photoPrev} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <MaterialCommunityIcons name="account" size={40} color="#7A8A89" />
                  </View>
                )}
                <View style={styles.photoActions}>
                  <Pressable style={styles.photoBtn} onPress={pickPhoto}>
                    <MaterialCommunityIcons name="image-outline" size={18} color="#1C2B2A" />
                    <Text style={styles.photoBtnText}>من الاستوديو</Text>
                  </Pressable>
                  <Pressable style={styles.photoBtn} onPress={takePhoto}>
                    <MaterialCommunityIcons name="camera-outline" size={18} color="#1C2B2A" />
                    <Text style={styles.photoBtnText}>صوّر دلوقت</Text>
                  </Pressable>
                  {photo && (
                    <Pressable style={[styles.photoBtn, { borderColor: "#CC2200" }]} onPress={() => setPhoto(null)}>
                      <MaterialCommunityIcons name="delete-outline" size={18} color="#CC2200" />
                      <Text style={[styles.photoBtnText, { color: "#CC2200" }]}>مسح الصورة</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Relation chips */}
              <Text style={styles.fieldLabel}>الصلة</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relRow}>
                {RELATIONS.map((r) => (
                  <Pressable
                    key={r}
                    style={[styles.relChip, relation === r && styles.relChipActive]}
                    onPress={() => { setRelation(r); if (!phrase) setPhrase(autoPhrase(name, r)); }}
                  >
                    <Text style={[styles.relChipText, relation === r && styles.relChipTextActive]}>{r}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Name */}
              <Text style={styles.fieldLabel}>الاسم (مثال: محمد)</Text>
              <TextInput
                style={styles.input} value={name}
                onChangeText={(v) => { setName(v); if (!phrase || phrase === autoPhrase(name, relation)) setPhrase(autoPhrase(v, relation)); }}
                placeholder="اكتب الاسم" placeholderTextColor="#9AABAA" textAlign="right"
              />

              {/* Phrase */}
              <Text style={styles.fieldLabel}>الجملة اللي ميزو بيقولها</Text>
              <TextInput
                style={styles.input} value={phrase} onChangeText={setPhrase}
                placeholder={`نادوا على ${relation} ${name}`}
                placeholderTextColor="#9AABAA" textAlign="right"
              />

              {/* Push token */}
              <Text style={styles.fieldLabel}>توكن الجهاز (اختياري)</Text>
              <TextInput
                style={styles.input} value={pushToken} onChangeText={setPushToken}
                placeholder="ExponentPushToken[...]"
                placeholderTextColor="#9AABAA" textAlign="left" autoCapitalize="none"
              />
              <Text style={styles.tokenHint}>
                محمود يفتح تطبيق ملاذ ← ميزو ← إعدادات العيلة وبيلاقي الكود هناك
              </Text>

              {/* Notify mode (only shown if token exists) */}
              {pushToken.trim().length > 10 && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 10 }]}>متى يوصله إشعار؟</Text>
                  <View style={styles.notifyRow}>
                    {NOTIFY_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.mode}
                        style={[styles.notifyChip, notifyMode === opt.mode && styles.notifyChipActive]}
                        onPress={() => setNotifyMode(opt.mode)}
                      >
                        <Text style={[styles.notifyChipLabel, notifyMode === opt.mode && styles.notifyChipLabelActive]}>
                          {opt.label}
                        </Text>
                        <Text style={[styles.notifyChipDesc, notifyMode === opt.mode && styles.notifyChipDescActive]}>
                          {opt.desc}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelText}>إلغاء</Text>
                </Pressable>
                <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  <Text style={styles.saveText}>{saving ? "جاري..." : "احفظ"}</Text>
                </Pressable>
              </View>
            </View>
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
  addBtn: { padding: 4 },
  body: { padding: 16 },
  hint: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#7A8A89", textAlign: "right", marginBottom: 16, lineHeight: 20 },

  empty: { alignItems: "center", marginTop: 40, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#1C2B2A" },
  emptyBtn: { backgroundColor: "#1C2B2A", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#C9A84C" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "flex-end" },
  card: {
    width: 106, alignItems: "center", backgroundColor: "#fff",
    borderRadius: 16, padding: 10, gap: 4,
    borderWidth: 1.5, borderColor: "#E0E8E7",
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 28, fontFamily: "Cairo_700Bold", color: "#fff" },
  cardName: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#1C2B2A", textAlign: "center" },
  cardRelation: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#7A8A89" },
  notifyBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#E8F5EF", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  notifyBadgeText: { fontFamily: "Cairo_400Regular", fontSize: 10, color: "#1C6B3A" },
  editIcon: { position: "absolute", top: 6, left: 6 },

  addCard: {
    width: 106, alignItems: "center", justifyContent: "center",
    borderRadius: 16, padding: 12, gap: 6,
    borderWidth: 2, borderColor: "#C9A84C55", borderStyle: "dashed", backgroundColor: "#FDFAF3",
    minHeight: 120,
  },
  addCardText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#C9A84C" },

  overlay: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  modalScroll: { flexGrow: 1, justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#1C2B2A", textAlign: "right", marginBottom: 16 },

  photoRow: { flexDirection: "row-reverse", gap: 14, alignItems: "flex-start", marginBottom: 16 },
  photoPrev: { width: 80, height: 80, borderRadius: 40 },
  photoPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#E8EDEC", alignItems: "center", justifyContent: "center" },
  photoActions: { flex: 1, gap: 8 },
  photoBtn: {
    flexDirection: "row-reverse", alignItems: "center", gap: 6,
    backgroundColor: "#F5F7F6", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: "#E0E8E7",
  },
  photoBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#1C2B2A" },

  fieldLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#1C2B2A", textAlign: "right", marginBottom: 6 },
  input: {
    backgroundColor: "#F5F7F6", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: "Cairo_400Regular", fontSize: 14, color: "#1C2B2A",
    borderWidth: 1, borderColor: "#E0E8E7", marginBottom: 12,
  },
  tokenHint: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#7A8A89", textAlign: "right", marginTop: -8, marginBottom: 12, lineHeight: 18 },

  relRow: { marginBottom: 12 },
  relChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#E8EDEC", marginLeft: 6 },
  relChipActive: { backgroundColor: "#1C2B2A" },
  relChipText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#1C2B2A" },
  relChipTextActive: { color: "#C9A84C" },

  notifyRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  notifyChip: {
    flex: 1, padding: 10, borderRadius: 12, alignItems: "center",
    backgroundColor: "#F5F7F6", borderWidth: 1.5, borderColor: "#E0E8E7",
  },
  notifyChipActive: { backgroundColor: "#1C2B2A11", borderColor: "#1C2B2A" },
  notifyChipLabel: { fontFamily: "Cairo_700Bold", fontSize: 12, color: "#1C2B2A", textAlign: "center" },
  notifyChipLabelActive: { color: "#1C2B2A" },
  notifyChipDesc: { fontFamily: "Cairo_400Regular", fontSize: 10, color: "#7A8A89", textAlign: "center", marginTop: 3 },
  notifyChipDescActive: { color: "#1C5C3A" },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#E8EDEC" },
  cancelText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#1C2B2A" },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#1C2B2A" },
  saveText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#C9A84C" },
});
