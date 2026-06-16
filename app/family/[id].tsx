import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { supabase, DbMedicalFile, DbMedicineReminder } from "@/lib/supabase";

const DARK = "#1C2B2A";
const GOLD = "#C9A84C";

const RELATIONS = ["الوالد", "الوالدة", "الزوج/ة", "ابن/ابنة", "أخ/أخت", "آخر"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const FILE_TYPES: { key: DbMedicalFile["file_type"]; label: string; icon: string }[] = [
  { key: "report", label: "تقرير طبي", icon: "file-document" },
  { key: "lab", label: "تحاليل", icon: "test-tube" },
  { key: "xray", label: "أشعة", icon: "radiology-box" },
  { key: "prescription", label: "روشتة", icon: "pill" },
  { key: "other", label: "أخرى", icon: "paperclip" },
];

// مواعيد كل نص ساعة من 6 صباحاً لـ 12 بالليل (مطابقة لجدولة السيرفر)
const TIME_SLOTS: string[] = [];
for (let h = 6; h < 24; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, "0")}:00`, `${String(h).padStart(2, "0")}:30`);
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "ص" : "م";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export default function FamilyMemberScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { client, familyMembers } = useApp();
  const member = familyMembers.find((m) => m.id === id);

  // ─── بيانات الملف ─────────────────────────────────────────────────────────
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [chronic, setChronic] = useState("");
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // ─── الملفات الطبية ───────────────────────────────────────────────────────
  const [files, setFiles] = useState<(DbMedicalFile & { url?: string })[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<DbMedicalFile["file_type"]>("report");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [viewer, setViewer] = useState<string | null>(null);

  // ─── الأدوية ──────────────────────────────────────────────────────────────
  const [reminders, setReminders] = useState<DbMedicineReminder[]>([]);
  const [medOpen, setMedOpen] = useState(false);
  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [medTimes, setMedTimes] = useState<string[]>([]);
  const [notifyCaregiver, setNotifyCaregiver] = useState(true);
  const [medBusy, setMedBusy] = useState(false);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);

  useEffect(() => {
    if (!member) return;
    setPhone(member.phone ?? "");
    setGender(member.gender ?? "");
    setBloodType(member.blood_type ?? "");
    setChronic(member.chronic_conditions ?? "");
    setAllergies(member.allergies ?? "");
    setNotes(member.notes ?? "");
  }, [member?.id]);

  const loadData = useCallback(async () => {
    if (!member || !client) return;
    const [filesRes, remRes] = await Promise.all([
      supabase.from("medical_files").select("*").eq("family_member_id", member.id).order("created_at", { ascending: false }),
      supabase.from("medicine_reminders").select("*").eq("family_member_id", member.id).eq("active", true).order("created_at"),
    ]);
    // روابط موقّتة للصور (الملفات في bucket خاص)
    const withUrls = await Promise.all(
      ((filesRes.data ?? []) as DbMedicalFile[]).map(async (f) => {
        const { data } = await supabase.storage.from("medical-files").createSignedUrl(f.storage_path, 3600);
        return { ...f, url: data?.signedUrl };
      })
    );
    setFiles(withUrls);
    setReminders((remRes.data ?? []) as DbMedicineReminder[]);
  }, [member?.id, client?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!client) {
    return (
      <Centered>
        <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 15, color: colors.foreground, textAlign: "center" }}>
          سجّل دخول لحسابك أولاً عشان تدير الملفات الطبية
        </Text>
      </Centered>
    );
  }
  if (!member) {
    return (
      <Centered>
        <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 15, color: colors.foreground }}>الفرد غير موجود</Text>
      </Centered>
    );
  }

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("family_members")
        .update({
          phone: phone.trim() || null,
          gender: gender || null,
          blood_type: bloodType || null,
          chronic_conditions: chronic.trim() || null,
          allergies: allergies.trim() || null,
          notes: notes.trim() || null,
        })
        .eq("id", member.id);
      if (error) throw new Error(error.message);
      Alert.alert("تم", "✅ تم حفظ الملف الطبي");
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  // ─── رفع ملف طبي ─────────────────────────────────────────────────────────
  const pickAndUpload = async () => {
    if (!uploadTitle.trim()) { Alert.alert("تنبيه", "اكتب اسم للملف (مثال: تحاليل سكر يونيو)"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("سجّل دخول أولاً");
      const asset = result.assets[0];
      const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${session.user.id}/${member.id}-${Date.now()}.${ext}`;
      const response = await fetch(asset.uri);
      const blob = await response.arrayBuffer();
      const { error: upErr } = await supabase.storage
        .from("medical-files")
        .upload(path, blob, { contentType: asset.mimeType ?? "image/jpeg" });
      if (upErr) throw new Error(upErr.message);
      const { error } = await supabase.from("medical_files").insert([{
        client_id: client.id,
        family_member_id: member.id,
        title: uploadTitle.trim(),
        file_type: uploadType,
        storage_path: path,
      }]);
      if (error) throw new Error(error.message);
      setUploadOpen(false); setUploadTitle("");
      loadData();
    } catch (e: any) {
      Alert.alert("خطأ", "تعذر الرفع: " + (e.message ?? ""));
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = (f: DbMedicalFile) => {
    Alert.alert("حذف", `حذف "${f.title}"؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف", style: "destructive",
        onPress: async () => {
          await supabase.storage.from("medical-files").remove([f.storage_path]);
          await supabase.from("medical_files").delete().eq("id", f.id);
          loadData();
        },
      },
    ]);
  };

  // ─── إضافة / تعديل دواء ──────────────────────────────────────────────────
  const openEditMed = (rem: DbMedicineReminder) => {
    setEditingMedId(rem.id);
    setMedName(rem.medicine_name);
    setMedDose(rem.dose ?? "");
    setMedTimes(rem.times);
    setNotifyCaregiver(rem.notify_caregiver ?? true);
    setMedOpen(true);
  };

  const resetMedForm = () => {
    setEditingMedId(null); setMedName(""); setMedDose(""); setMedTimes([]); setNotifyCaregiver(true);
  };

  const saveMedicine = async () => {
    if (!medName.trim()) { Alert.alert("تنبيه", "اكتب اسم الدواء"); return; }
    if (!medTimes.length) { Alert.alert("تنبيه", "اختر وقت واحد على الأقل"); return; }
    setMedBusy(true);
    try {
      if (editingMedId) {
        const { error } = await supabase.from("medicine_reminders").update({
          medicine_name: medName.trim(),
          dose: medDose.trim() || null,
          times: medTimes,
          notify_caregiver: notifyCaregiver,
        }).eq("id", editingMedId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("medicine_reminders").insert([{
          client_id: client.id,
          family_member_id: member.id,
          medicine_name: medName.trim(),
          dose: medDose.trim() || null,
          times: medTimes,
          notify_caregiver: notifyCaregiver,
        }]);
        if (error) throw new Error(error.message);
      }
      setMedOpen(false); resetMedForm();
      loadData();
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "تعذر الحفظ");
    } finally {
      setMedBusy(false);
    }
  };

  const deleteMedicine = (rem: DbMedicineReminder) => {
    Alert.alert("حذف", `إيقاف تذكير "${rem.medicine_name}"؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف", style: "destructive",
        onPress: async () => {
          await supabase.from("medicine_reminders").update({ active: false }).eq("id", rem.id);
          loadData();
        },
      },
    ]);
  };

  const inputStyle = {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    color: colors.foreground,
    textAlign: "right" as const,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: DARK, paddingTop: insets.top + 12, paddingBottom: 18, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#FFFFFF15", alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name="chevron-right" size={24} color={GOLD} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: GOLD, fontFamily: "Cairo_700Bold", fontSize: 18, textAlign: "right" }}>
              🩺 الملف الطبي — {member.name}
            </Text>
            <Text style={{ color: "#FFFFFF66", fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right" }}>
              {member.relation ?? ""}{member.birth_year ? ` · مواليد ${member.birth_year}` : ""}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }} keyboardShouldPersistTaps="handled">

        {/* ─── البيانات الصحية ─── */}
        <SectionTitle icon="account-heart" label="البيانات الصحية" />

        <View>
          <FieldLabel text="رقم موبايله (لو عنده التطبيق هتوصله تذكيرات أدويته عليه)" />
          <TextInput style={inputStyle} value={phone} onChangeText={setPhone} placeholder="01xxxxxxxxx" placeholderTextColor={colors.mutedForeground} keyboardType="phone-pad" />
        </View>

        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          {["ذكر", "أنثى"].map((g) => (
            <Pressable key={g} onPress={() => setGender(g)}
              style={{ flex: 1, padding: 10, borderRadius: 12, alignItems: "center", borderWidth: 1.5, borderColor: gender === g ? GOLD : colors.border, backgroundColor: gender === g ? "rgba(201,168,76,0.1)" : colors.card }}>
              <Text style={{ fontFamily: "Cairo_600SemiBold", fontSize: 13, color: gender === g ? "#b8860b" : colors.mutedForeground }}>{g}</Text>
            </Pressable>
          ))}
        </View>

        <View>
          <FieldLabel text="فصيلة الدم" />
          <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 }}>
            {BLOOD_TYPES.map((b) => (
              <Pressable key={b} onPress={() => setBloodType(b)}
                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: bloodType === b ? GOLD : colors.border, backgroundColor: bloodType === b ? "rgba(201,168,76,0.12)" : colors.card }}>
                <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 12, color: bloodType === b ? "#b8860b" : colors.mutedForeground }}>{b}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <FieldLabel text="الأمراض المزمنة" />
          <TextInput style={[inputStyle, { minHeight: 60, textAlignVertical: "top" }]} value={chronic} onChangeText={setChronic} multiline placeholder="مثال: سكري النوع الثاني، ضغط مرتفع..." placeholderTextColor={colors.mutedForeground} />
        </View>
        <View>
          <FieldLabel text="الحساسية" />
          <TextInput style={[inputStyle, { minHeight: 50, textAlignVertical: "top" }]} value={allergies} onChangeText={setAllergies} multiline placeholder="مثال: بنسلين، فول سوداني..." placeholderTextColor={colors.mutedForeground} />
        </View>
        <View>
          <FieldLabel text="ملاحظات إضافية" />
          <TextInput style={[inputStyle, { minHeight: 50, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} multiline placeholder="أي معلومات مهمة لمقدم الخدمة..." placeholderTextColor={colors.mutedForeground} />
        </View>

        <Pressable onPress={saveProfile} disabled={saving} style={{ backgroundColor: DARK, borderRadius: 12, padding: 14, alignItems: "center", opacity: saving ? 0.6 : 1 }}>
          <Text style={{ color: GOLD, fontFamily: "Cairo_700Bold", fontSize: 14 }}>{saving ? "جاري الحفظ..." : "💾 حفظ البيانات الصحية"}</Text>
        </Pressable>

        {/* ─── الملفات الطبية ─── */}
        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <SectionTitle icon="folder-heart" label={`الملفات الطبية (${files.length})`} noBorder />
          <Pressable onPress={() => setUploadOpen(true)} style={{ backgroundColor: GOLD, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}>
            <Text style={{ color: DARK, fontFamily: "Cairo_700Bold", fontSize: 12 }}>+ رفع صورة</Text>
          </Pressable>
        </View>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right", marginTop: -8 }}>
          صور التقارير والتحاليل والأشعة والروشتات — مرجع جاهز تعرضه لأي دكتور
        </Text>

        {files.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "center", padding: 14 }}>
            مفيش ملفات مرفوعة لسه
          </Text>
        ) : (
          <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 }}>
            {files.map((f) => {
              const typeInfo = FILE_TYPES.find((t) => t.key === f.file_type);
              return (
                <Pressable key={f.id} onPress={() => f.url && setViewer(f.url)} onLongPress={() => deleteFile(f)}
                  style={{ width: "47%", backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
                  {f.url ? (
                    <Image source={{ uri: f.url }} style={{ width: "100%", height: 110 }} contentFit="cover" />
                  ) : (
                    <View style={{ width: "100%", height: 110, backgroundColor: colors.surfaceMuted }} />
                  )}
                  <View style={{ padding: 8 }}>
                    <Text numberOfLines={1} style={{ fontFamily: "Cairo_700Bold", fontSize: 12, color: colors.foreground, textAlign: "right" }}>{f.title}</Text>
                    <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 10, color: colors.mutedForeground, textAlign: "right" }}>
                      <MaterialCommunityIcons name={(typeInfo?.icon ?? "paperclip") as any} size={10} /> {typeInfo?.label} · {new Date(f.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        {files.length > 0 ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 10, textAlign: "center" }}>
            اضغط على الصورة لعرضها بالكامل — اضغط مطوّلاً للحذف
          </Text>
        ) : null}

        {/* ─── الأدوية ─── */}
        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <SectionTitle icon="pill" label={`أدويته (${reminders.length})`} noBorder />
          <Pressable onPress={() => setMedOpen(true)} style={{ backgroundColor: GOLD, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}>
            <Text style={{ color: DARK, fontFamily: "Cairo_700Bold", fontSize: 12 }}>+ إضافة دواء</Text>
          </Pressable>
        </View>
        <View style={{ backgroundColor: "rgba(201,168,76,0.08)", borderWidth: 1, borderColor: "rgba(201,168,76,0.25)", borderRadius: 12, padding: 10, marginTop: -6 }}>
          <Text style={{ color: "#b8860b", fontFamily: "Cairo_400Regular", fontSize: 11, textAlign: "right", lineHeight: 18 }}>
            🔔 في معاد كل جرعة: إشعار بيوصل {member.name} على تطبيقه (لو رقمه متسجل فوق ومنزّل التطبيق) + إشعار ليك إنت تطمن عليه وتتأكد إنه أخد الدواء
          </Text>
        </View>

        {reminders.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "center", padding: 10 }}>
            مفيش أدوية متسجلة
          </Text>
        ) : (
          reminders.map((rem) => (
            <View key={rem.id} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 }}>
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 14, textAlign: "right" }}>💊 {rem.medicine_name}</Text>
                  {rem.dose ? <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 11, textAlign: "right" }}>{rem.dose}</Text> : null}
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable onPress={() => openEditMed(rem)} style={{ backgroundColor: "rgba(201,168,76,0.12)", borderRadius: 8, padding: 6 }}>
                    <MaterialCommunityIcons name="pencil-outline" size={15} color="#b8860b" />
                  </Pressable>
                  <Pressable onPress={() => deleteMedicine(rem)} style={{ backgroundColor: "#FEE2E2", borderRadius: 8, padding: 6 }}>
                    <MaterialCommunityIcons name="trash-can-outline" size={15} color="#DC2626" />
                  </Pressable>
                </View>
              </View>
              <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {rem.times.map((t) => (
                  <View key={t} style={{ backgroundColor: "rgba(201,168,76,0.1)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(201,168,76,0.3)" }}>
                    <Text style={{ color: "#b8860b", fontFamily: "Cairo_600SemiBold", fontSize: 11 }}>⏰ {formatTime(t)}</Text>
                  </View>
                ))}
                {rem.notify_caregiver ? (
                  <View style={{ backgroundColor: "#7C3AED14", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ color: "#7C3AED", fontFamily: "Cairo_600SemiBold", fontSize: 11 }}>📞 بيوصلك تنبيه تطمن عليه</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ─── مودال رفع ملف ─── */}
      <Modal visible={uploadOpen} transparent animationType="slide" onRequestClose={() => setUploadOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={() => setUploadOpen(false)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", marginBottom: 14 }}>رفع ملف طبي</Text>
            <TextInput value={uploadTitle} onChangeText={setUploadTitle} placeholder="اسم الملف (مثال: تحاليل سكر — يونيو) *" placeholderTextColor={colors.mutedForeground}
              style={[inputStyle, { backgroundColor: colors.surfaceMuted, marginBottom: 10 }]} />
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {FILE_TYPES.map((t) => (
                <Pressable key={t.key} onPress={() => setUploadType(t.key)}
                  style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: uploadType === t.key ? GOLD : colors.border, backgroundColor: uploadType === t.key ? "rgba(201,168,76,0.12)" : colors.surfaceMuted }}>
                  <MaterialCommunityIcons name={t.icon as any} size={14} color={uploadType === t.key ? "#b8860b" : colors.mutedForeground} />
                  <Text style={{ fontFamily: "Cairo_600SemiBold", fontSize: 12, color: uploadType === t.key ? "#b8860b" : colors.mutedForeground }}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={pickAndUpload} disabled={uploading} style={{ backgroundColor: GOLD, borderRadius: 12, padding: 14, alignItems: "center", opacity: uploading ? 0.6 : 1 }}>
              <Text style={{ color: DARK, fontFamily: "Cairo_700Bold", fontSize: 14 }}>{uploading ? "جاري الرفع..." : "📷 اختر الصورة وارفعها"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── عارض الصور ─── */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center" }} onPress={() => setViewer(null)}>
          {viewer ? <Image source={{ uri: viewer }} style={{ width: "100%", height: "80%" }} contentFit="contain" /> : null}
        </Pressable>
      </Modal>

      {/* ─── مودال إضافة / تعديل دواء ─── */}
      <Modal visible={medOpen} transparent animationType="slide" onRequestClose={() => { setMedOpen(false); resetMedForm(); }}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={() => { setMedOpen(false); resetMedForm(); }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%" }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", marginBottom: 14 }}>
                {editingMedId ? `تعديل دواء — ${member.name}` : `إضافة دواء لـ ${member.name}`}
              </Text>
              <TextInput value={medName} onChangeText={setMedName} placeholder="اسم الدواء * (مثال: أنسولين)" placeholderTextColor={colors.mutedForeground}
                style={[inputStyle, { backgroundColor: colors.surfaceMuted, marginBottom: 10 }]} />
              <TextInput value={medDose} onChangeText={setMedDose} placeholder="الجرعة (مثال: 10 وحدات قبل الأكل) — اختياري" placeholderTextColor={colors.mutedForeground}
                style={[inputStyle, { backgroundColor: colors.surfaceMuted, marginBottom: 12 }]} />

              <Text style={{ color: colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 13, textAlign: "right", marginBottom: 8 }}>
                مواعيد الجرعات ({medTimes.length} مختار)
              </Text>
              <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {TIME_SLOTS.map((t) => {
                  const active = medTimes.includes(t);
                  return (
                    <Pressable key={t} onPress={() => setMedTimes((p) => active ? p.filter((x) => x !== t) : [...p, t].sort())}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1.5, borderColor: active ? GOLD : colors.border, backgroundColor: active ? DARK : colors.surfaceMuted }}>
                      <Text style={{ fontSize: 11, fontFamily: "Cairo_600SemiBold", color: active ? GOLD : colors.mutedForeground }}>{formatTime(t)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 12, marginBottom: 14 }}>
                <Text style={{ color: colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 13, flex: 1, textAlign: "right" }}>
                  📞 ابعتلي تنبيه أطمن عليه في معاد كل جرعة
                </Text>
                <Switch value={notifyCaregiver} onValueChange={setNotifyCaregiver} trackColor={{ false: "#ccc", true: "#43A047" }} thumbColor="#FFFFFF" />
              </View>

              <Pressable onPress={saveMedicine} disabled={medBusy} style={{ backgroundColor: GOLD, borderRadius: 12, padding: 14, alignItems: "center", opacity: medBusy ? 0.6 : 1 }}>
                <Text style={{ color: DARK, fontFamily: "Cairo_700Bold", fontSize: 14 }}>{medBusy ? "جاري الحفظ..." : editingMedId ? "حفظ التعديلات" : "حفظ وتفعيل التذكير"}</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function FieldLabel({ text }: { text: string }) {
  const colors = useColors();
  return (
    <Text style={{ color: colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 13, textAlign: "right", marginBottom: 6 }}>
      {text}
    </Text>
  );
}

function SectionTitle({ icon, label, noBorder }: { icon: any; label: string; noBorder?: boolean }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, ...(noBorder ? {} : { paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }) }}>
      <MaterialCommunityIcons name={icon} size={16} color={GOLD} />
      <Text style={{ fontSize: 15, fontFamily: "Cairo_700Bold", color: colors.foreground }}>{label}</Text>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 30 }}>
      {children}
    </View>
  );
}
