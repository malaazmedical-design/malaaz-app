import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const DARK = "#1C2B2A";
const GOLD = "#C9A84C";
const STORAGE_KEY = "malaaz.medicines.v1";

type Medicine = {
  id: string;
  name: string;
  dose: string;
  times: string[]; // "08:00"
  notificationIds: string[];
};

// أوقات جاهزة للاختيار السريع
const QUICK_TIMES = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "صباحاً" : "مساءً";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export default function MedicinesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setMedicines(JSON.parse(raw));
    }).catch(() => {});
  }, []);

  const persist = async (next: Medicine[]) => {
    setMedicines(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const toggleTime = (t: string) => {
    setTimes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].sort()));
  };

  const openEdit = (m: Medicine) => {
    setEditingId(m.id);
    setName(m.name);
    setDose(m.dose);
    setTimes(m.times);
    setOpen(true);
  };

  const addMedicine = async () => {
    if (!name.trim()) { Alert.alert("تنبيه", "اكتب اسم الدواء"); return; }
    if (!times.length) { Alert.alert("تنبيه", "اختر وقت واحد على الأقل"); return; }
    setBusy(true);
    try {
      // إذن الإشعارات
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted" && Platform.OS !== "web") {
        Alert.alert("تنبيه", "فعّل الإشعارات من إعدادات الهاتف عشان التذكير يشتغل");
      }

      // جدولة إشعار يومي متكرر لكل وقت
      const notificationIds: string[] = [];
      if (Platform.OS !== "web" && status === "granted") {
        for (const t of times) {
          const [hour, minute] = t.split(":").map(Number);
          const nid = await Notifications.scheduleNotificationAsync({
            content: {
              title: `💊 ميعاد الدواء: ${name.trim()}`,
              body: dose.trim() ? `الجرعة: ${dose.trim()}` : "متنساش جرعتك — صحتك أولوية 💙",
              sound: "default",
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour,
              minute,
            },
          });
          notificationIds.push(nid);
        }
      }

      if (editingId) {
        // تعديل: إلغاء الإشعارات القديمة وتحديث بيانات الدواء
        const existing = medicines.find((m) => m.id === editingId);
        if (existing) {
          for (const nid of existing.notificationIds) {
            await Notifications.cancelScheduledNotificationAsync(nid).catch(() => {});
          }
        }
        const updated = medicines.map((m) =>
          m.id === editingId
            ? { ...m, name: name.trim(), dose: dose.trim(), times, notificationIds }
            : m
        );
        await persist(updated);
      } else {
        const med: Medicine = {
          id: Date.now().toString(),
          name: name.trim(),
          dose: dose.trim(),
          times,
          notificationIds,
        };
        await persist([...medicines, med]);
      }
      setEditingId(null); setOpen(false); setName(""); setDose(""); setTimes([]);
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  const removeMedicine = async (med: Medicine) => {
    Alert.alert("حذف", `إيقاف تذكير "${med.name}"؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          for (const nid of med.notificationIds) {
            await Notifications.cancelScheduledNotificationAsync(nid).catch(() => {});
          }
          await persist(medicines.filter((m) => m.id !== med.id));
        },
      },
    ]);
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
            <Text style={{ color: GOLD, fontFamily: "Cairo_700Bold", fontSize: 18, textAlign: "right" }}>💊 تذكير الأدوية</Text>
            <Text style={{ color: "#FFFFFF66", fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right" }}>
              التطبيق يفكّرك بمواعيد أدويتك يومياً
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
        {medicines.length === 0 ? (
          <View style={{ alignItems: "center", padding: 40 }}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>💊</Text>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "center" }}>
              مفيش أدوية متسجلة
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "center", marginTop: 6, lineHeight: 22 }}>
              أضف أدويتك ومواعيدها وهيوصلك إشعار يومي{"\n"}في معاد كل جرعة
            </Text>
          </View>
        ) : (
          medicines.map((m) => (
            <View key={m.id} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 10 }}>
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 15, textAlign: "right" }}>💊 {m.name}</Text>
                  {m.dose ? (
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right", marginTop: 2 }}>{m.dose}</Text>
                  ) : null}
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable onPress={() => openEdit(m)} style={{ backgroundColor: "rgba(201,168,76,0.12)", borderRadius: 8, padding: 7, marginRight: 6 }}>
                    <MaterialCommunityIcons name="pencil-outline" size={16} color="#b8860b" />
                  </Pressable>
                  <Pressable onPress={() => removeMedicine(m)} style={{ backgroundColor: "#FEE2E2", borderRadius: 8, padding: 7 }}>
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color="#DC2626" />
                  </Pressable>
                </View>
              </View>
              <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {m.times.map((t) => (
                  <View key={t} style={{ backgroundColor: "rgba(201,168,76,0.1)", borderWidth: 1, borderColor: "rgba(201,168,76,0.3)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: "#b8860b", fontFamily: "Cairo_600SemiBold", fontSize: 11 }}>⏰ {formatTime(t)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* زرار إضافة */}
      <View style={{ position: "absolute", bottom: insets.bottom + 20, left: 20, right: 20 }}>
        <Pressable onPress={() => setOpen(true)} style={({ pressed }) => ({ backgroundColor: GOLD, borderRadius: 16, padding: 16, alignItems: "center", flexDirection: "row-reverse", justifyContent: "center", gap: 8, opacity: pressed ? 0.9 : 1 })}>
          <MaterialCommunityIcons name="plus-circle" size={20} color={DARK} />
          <Text style={{ color: DARK, fontFamily: "Cairo_700Bold", fontSize: 15 }}>إضافة دواء</Text>
        </Pressable>
      </View>

      {/* مودال إضافة دواء */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => { setOpen(false); setEditingId(null); setName(""); setDose(""); setTimes([]); }}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={() => { setOpen(false); setEditingId(null); setName(""); setDose(""); setTimes([]); }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", marginBottom: 14 }}>{editingId ? "تعديل دواء" : "إضافة دواء"}</Text>

            <TextInput value={name} onChangeText={setName} placeholder="اسم الدواء *" placeholderTextColor={colors.mutedForeground}
              style={{ backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 12, textAlign: "right", fontFamily: "Cairo_400Regular", fontSize: 13, color: colors.foreground, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 }} />

            <TextInput value={dose} onChangeText={setDose} placeholder="الجرعة (مثال: قرص واحد بعد الأكل) — اختياري" placeholderTextColor={colors.mutedForeground}
              style={{ backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 12, textAlign: "right", fontFamily: "Cairo_400Regular", fontSize: 13, color: colors.foreground, borderWidth: 1.5, borderColor: colors.border, marginBottom: 12 }} />

            <Text style={{ color: colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 13, textAlign: "right", marginBottom: 8 }}>
              مواعيد التذكير اليومي ({times.length} مختار)
            </Text>
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {QUICK_TIMES.map((t) => {
                const active = times.includes(t);
                return (
                  <Pressable key={t} onPress={() => toggleTime(t)}
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, backgroundColor: active ? DARK : colors.surfaceMuted, borderColor: active ? GOLD : colors.border }}>
                    <Text style={{ fontSize: 12, fontFamily: "Cairo_600SemiBold", color: active ? GOLD : colors.foreground }}>{formatTime(t)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable onPress={addMedicine} disabled={busy} style={{ backgroundColor: GOLD, borderRadius: 12, padding: 14, alignItems: "center", opacity: busy ? 0.6 : 1 }}>
              <Text style={{ color: DARK, fontFamily: "Cairo_700Bold", fontSize: 14 }}>{busy ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "حفظ وتفعيل التذكير"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
