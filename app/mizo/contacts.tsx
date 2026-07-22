import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, Pressable,
  ScrollView, TextInput, Alert, Modal, Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  getContacts, addContact, updateContact, deleteContact, MizoContact,
} from "@/lib/mizoStorage";

const RELATIONS = ["بابا", "ماما", "ابن", "بنت", "زوج", "زوجة", "أخ", "أخت", "جد", "جدة", "ممرض", "دكتور", "صاحب", "أخرى"];

export default function MizoContactsScreen() {
  const [contacts, setContacts] = useState<MizoContact[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState(RELATIONS[0]);
  const [phrase, setPhrase] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getContacts().then(setContacts);
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setName(""); setRelation(RELATIONS[0]);
    setPhrase(""); setPhoto(null);
    setModalVisible(true);
  };

  const openEdit = (c: MizoContact) => {
    setEditingId(c.id);
    setName(c.name); setRelation(c.relation);
    setPhrase(c.phrase); setPhoto(c.photo);
    setModalVisible(true);
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("تنبيه", "محتاج صلاحية الوصول للصور"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.25,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("تنبيه", "محتاج صلاحية الكاميرا"); return; }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.25,
      base64: true,
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
    if (editingId) {
      await updateContact(editingId, { name: name.trim(), relation, phrase: finalPhrase, photo });
      setContacts((prev) => prev.map((c) => c.id === editingId ? { ...c, name: name.trim(), relation, phrase: finalPhrase, photo } : c));
    } else {
      const c = await addContact({ name: name.trim(), relation, phrase: finalPhrase, photo });
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
        onPress: async () => {
          await deleteContact(id);
          setContacts((prev) => prev.filter((c) => c.id !== id));
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
        <Text style={styles.headerTitle}>عيلتي</Text>
        <Pressable onPress={openAdd} style={styles.addBtn}>
          <MaterialCommunityIcons name="plus" size={26} color="#C9A84C" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.hint}>
          البطاقات دي بتظهر في قائمة "العيلة" في ميزو — اضغط عليها المريض ويقدر ينادي على أي حد باسمه وصورته
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
            {contacts.map((c) => (
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
                <Pressable style={styles.editIcon} onPress={() => openEdit(c)}>
                  <MaterialCommunityIcons name="pencil" size={14} color="#7A8A89" />
                </Pressable>
              </Pressable>
            ))}
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
                  onPress={() => {
                    setRelation(r);
                    if (!phrase) setPhrase(autoPhrase(name, r));
                  }}
                >
                  <Text style={[styles.relChipText, relation === r && styles.relChipTextActive]}>{r}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Name */}
            <Text style={styles.fieldLabel}>الاسم (مثال: محمد)</Text>
            <TextInput
              style={styles.input} value={name} onChangeText={(v) => {
                setName(v);
                if (!phrase || phrase === autoPhrase(name, relation)) setPhrase(autoPhrase(v, relation));
              }}
              placeholder="اكتب الاسم" placeholderTextColor="#9AABAA" textAlign="right"
            />

            {/* Phrase */}
            <Text style={styles.fieldLabel}>الجملة اللي ميزو بيقولها</Text>
            <TextInput
              style={styles.input} value={phrase} onChangeText={setPhrase}
              placeholder={`نادوا على ${relation} ${name}`}
              placeholderTextColor="#9AABAA" textAlign="right"
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>إلغاء</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveText}>{saving ? "جاري..." : "احفظ"}</Text>
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
  hint: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#7A8A89", textAlign: "right", marginBottom: 16, lineHeight: 20 },

  empty: { alignItems: "center", marginTop: 40, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#1C2B2A" },
  emptyBtn: { backgroundColor: "#1C2B2A", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#C9A84C" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "flex-end" },
  card: {
    width: 100, alignItems: "center", backgroundColor: "#fff",
    borderRadius: 16, padding: 12, gap: 6,
    borderWidth: 1.5, borderColor: "#E0E8E7",
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 28, fontFamily: "Cairo_700Bold", color: "#fff" },
  cardName: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#1C2B2A", textAlign: "center" },
  cardRelation: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#7A8A89" },
  editIcon: { position: "absolute", top: 6, left: 6 },

  addCard: {
    width: 100, alignItems: "center", justifyContent: "center",
    borderRadius: 16, padding: 12, gap: 6,
    borderWidth: 2, borderColor: "#C9A84C55", borderStyle: "dashed", backgroundColor: "#FDFAF3",
    minHeight: 120,
  },
  addCardText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#C9A84C" },

  overlay: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "92%" },
  modalTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#1C2B2A", textAlign: "right", marginBottom: 16 },

  photoRow: { flexDirection: "row-reverse", gap: 14, alignItems: "flex-start", marginBottom: 16 },
  photoPrev: { width: 80, height: 80, borderRadius: 40 },
  photoPlaceholder: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#E8EDEC",
    alignItems: "center", justifyContent: "center",
  },
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
  relRow: { marginBottom: 12 },
  relChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#E8EDEC", marginLeft: 6 },
  relChipActive: { backgroundColor: "#1C2B2A" },
  relChipText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#1C2B2A" },
  relChipTextActive: { color: "#C9A84C" },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#E8EDEC" },
  cancelText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#1C2B2A" },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#1C2B2A" },
  saveText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#C9A84C" },
});
