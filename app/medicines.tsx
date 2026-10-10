import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { Text, TextInput } from "@/components/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Toggle } from "@/components/account/AccountUI";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { toEnglishDigits } from "@/lib/digits";

const STORAGE_KEY = "malaaz.medicines.v1";

type Medicine = {
  id: string;
  name: string;
  dose: string;          // "½" | "1" | "1½" | "2" | "3" | free text (older records)
  unit?: string;         // قرص | كبسولة | مللي | نقطة (absent on older records)
  times: string[];       // "08:00" (24h), 1–4 per day
  on?: boolean;          // reminders enabled (absent = enabled)
  notificationIds: string[];
};

const DOSES = [
  { value: "½", label: "نصف" },
  { value: "1", label: "1" },
  { value: "1½", label: "1½" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
];
const UNITS = ["قرص", "كبسولة", "مللي", "نقطة"];
const FREQS = [
  { n: 1, label: "مرة" },
  { n: 2, label: "مرتين" },
  { n: 3, label: "3 مرات" },
  { n: 4, label: "4 مرات" },
];
const DEFAULT_TIMES = ["08:00", "14:00", "20:00", "23:00"];
const SLOT_NAMES = ["الأولى", "الثانية", "الثالثة", "الرابعة"];

const freqLabel = (n: number) => (n === 1 ? "مرة يوميًا" : n === 2 ? "مرتين يوميًا" : `${n} مرات يوميًا`);
const doseLabel = (m: Pick<Medicine, "dose" | "unit">) => {
  const d = m.dose === "½" ? "نصف" : m.dose;
  return [d, m.unit].filter(Boolean).join(" ");
};
const shortTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "ص" : "م"}`;
};

// A time slot edited as 12h hour + minutes + AM/PM (no native picker needed).
type Slot = { h: string; m: string; pm: boolean };
const toSlot = (t: string): Slot => {
  const [h, m] = t.split(":").map(Number);
  return { h: String(h % 12 === 0 ? 12 : h % 12), m: String(m).padStart(2, "0"), pm: h >= 12 };
};
const slotTo24 = (s: Slot): string | null => {
  const h = Number(s.h), m = Number(s.m);
  if (!s.h || !s.m || !(h >= 1 && h <= 12) || !(m >= 0 && m <= 59)) return null;
  const h24 = (h % 12) + (s.pm ? 12 : 0);
  return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export default function MedicinesScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [form, setForm] = useState<null | { id: string | null; name: string; dose: string; unit: string; count: number; slots: Slot[] }>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(async (raw) => {
      if (raw) setMedicines(JSON.parse(raw));
      else if (Platform.OS !== "web") {
        // after a reinstall, cancel any leftover medicine notifications from the previous install
        await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
      }
    }).catch(() => {});
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  };

  const persist = async (next: Medicine[]) => {
    setMedicines(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const cancelIds = async (ids: string[]) => {
    for (const id of ids) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  };

  // schedules one repeating daily notification per time; returns their ids
  const schedule = async (m: Pick<Medicine, "name" | "dose" | "unit" | "times">): Promise<string[]> => {
    if (Platform.OS === "web") return [];
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("تنبيه", "فعّل الإشعارات من إعدادات الهاتف عشان التذكير يشتغل");
      return [];
    }
    const ids: string[] = [];
    const label = doseLabel(m);
    for (const time of m.times) {
      const [hour, minute] = time.split(":").map(Number);
      ids.push(await Notifications.scheduleNotificationAsync({
        content: {
          title: `💊 ميعاد الدواء: ${m.name}`,
          body: label ? `الجرعة: ${label}` : "متنساش جرعتك — صحتك أولوية 💙",
          sound: "default",
          data: { type: "medicine" },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
      }));
    }
    return ids;
  };

  const openForm = (m?: Medicine) => {
    if (m) {
      setForm({ id: m.id, name: m.name, dose: m.dose, unit: m.unit ?? "", count: Math.min(4, Math.max(1, m.times.length)), slots: m.times.map(toSlot) });
    } else {
      setForm({ id: null, name: "", dose: "1", unit: "قرص", count: 1, slots: [toSlot(DEFAULT_TIMES[0])] });
    }
  };

  // changing times-per-day keeps the times already entered and fills the rest with defaults
  const setCount = (n: number) =>
    setForm((f) => f && {
      ...f, count: n,
      slots: Array.from({ length: n }, (_, i) => f.slots[i] ?? toSlot(DEFAULT_TIMES[i])),
    });

  const patchSlot = (i: number, patch: Partial<Slot>) =>
    setForm((f) => f && { ...f, slots: f.slots.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  const save = async () => {
    if (!form) return;
    const times = form.slots.map(slotTo24);
    if (!form.name.trim() || !form.dose.trim() || times.some((x) => !x)) {
      Alert.alert("تنبيه", "اكتب اسم الدواء والجرعة وكل مواعيد التذكير بشكل صحيح");
      return;
    }
    const sorted = (times as string[]).slice().sort();
    setBusy(true);
    try {
      const existing = form.id ? medicines.find((m) => m.id === form.id) : undefined;
      if (existing) await cancelIds(existing.notificationIds);
      const base = { name: form.name.trim(), dose: form.dose.trim(), unit: form.unit || undefined, times: sorted };
      const enabled = existing ? existing.on !== false : true;
      const notificationIds = enabled ? await schedule(base) : [];
      if (existing) {
        await persist(medicines.map((m) => (m.id === existing.id ? { ...m, ...base, notificationIds } : m)));
        showToast("تم حفظ التعديل");
      } else {
        await persist([...medicines, { id: Date.now().toString(), ...base, on: true, notificationIds }]);
        showToast("تمت إضافة التذكير");
      }
      setForm(null);
    } catch (e: any) {
      Alert.alert("خطأ", e?.message ?? "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    const med = form?.id ? medicines.find((m) => m.id === form.id) : undefined;
    if (!med) return;
    Alert.alert("حذف", `إيقاف تذكير "${med.name}"؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف", style: "destructive",
        onPress: async () => {
          await cancelIds(med.notificationIds);
          await persist(medicines.filter((m) => m.id !== med.id));
          setForm(null);
          showToast("تم حذف الدواء");
        },
      },
    ]);
  };

  const toggleOn = async (m: Medicine, on: boolean) => {
    if (on) {
      const ids = await schedule(m);
      await persist(medicines.map((x) => (x.id === m.id ? { ...x, on: true, notificationIds: ids } : x)));
    } else {
      await cancelIds(m.notificationIds);
      await persist(medicines.map((x) => (x.id === m.id ? { ...x, on: false, notificationIds: [] } : x)));
    }
  };

  const chip = (active: boolean) => ({
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 22, borderWidth: 1.5, alignItems: "center" as const,
    backgroundColor: active ? t.goldTint : t.card, borderColor: active ? t.gold : t.border,
  });
  const chipText = (active: boolean) => ({ color: active ? t.gold : t.text, fontFamily: TJ.bold, fontSize: 14 });
  const label = (text: string) => (
    <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 14.5, textAlign: "right", marginBottom: 10 }}>{text}</Text>
  );
  const inputStyle = {
    backgroundColor: t.bg, borderRadius: 16, borderWidth: 1, borderColor: t.border, paddingHorizontal: 14, height: 52,
    color: t.text, fontFamily: TJ.medium, fontSize: 14.5, textAlign: "right" as const,
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 12 + webTopInset, paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="رجوع" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="arrow-right" size={22} color={t.text} />
        </Pressable>
        <Text style={{ flex: 1, color: t.text, fontFamily: TJ.heavy, fontSize: 26, textAlign: "right" }}>تذكير الأدوية</Text>
        <Pressable onPress={() => openForm()} style={{ backgroundColor: t.gold, borderRadius: 22, paddingHorizontal: 18, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 15 }}>+ دواء</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {medicines.length === 0 ? (
          <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "center", paddingVertical: 60, lineHeight: 24 }}>
            لا توجد أدوية. اضغط + دواء للإضافة
          </Text>
        ) : (
          medicines.map((m) => {
            const on = m.on !== false;
            return (
              <Pressable
                key={m.id}
                onPress={() => openForm(m)}
                style={({ pressed }) => ({
                  backgroundColor: t.card, borderRadius: 24, borderWidth: 1, borderColor: t.border, padding: 16, gap: 12,
                  opacity: on ? 1 : 0.55, transform: [{ scale: pressed ? 0.99 : 1 }],
                })}
              >
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 14 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: t.ic, alignItems: "center", justifyContent: "center" }}>
                    <MaterialCommunityIcons name="pill" size={26} color={t.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 16, textAlign: "right" }}>{m.name}</Text>
                    <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13, textAlign: "right", marginTop: 2 }}>
                      {[doseLabel(m), freqLabel(m.times.length)].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  <Toggle on={on} onChange={(v) => toggleOn(m, v)} />
                </View>
                <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
                  {m.times.map((x) => (
                    <View key={x} style={{ backgroundColor: t.goldTint, borderRadius: 18, borderWidth: 1, borderColor: t.goldRing, paddingHorizontal: 14, paddingVertical: 5 }}>
                      <Text style={{ color: t.goldText, fontFamily: TJ.bold, fontSize: 13 }}>{shortTime(x)}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Toast */}
      {toast ? (
        <View pointerEvents="none" style={{ position: "absolute", top: insets.top + 8 + webTopInset, left: 24, right: 24, backgroundColor: t.gold, borderRadius: 16, paddingVertical: 12, alignItems: "center" }}>
          <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 14 }}>{toast}</Text>
        </View>
      ) : null}

      {/* Add / edit sheet */}
      <Modal visible={!!form} transparent animationType="slide" onRequestClose={() => setForm(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,.45)", justifyContent: "flex-end" }} onPress={() => setForm(null)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: t.hdr, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: "92%" }}>
            {form ? (
              <>
                <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 22, textAlign: "center" }}>{form.id ? "تعديل الدواء" : "إضافة دواء"}</Text>

                  <View>
                    {label("اسم الدواء")}
                    <TextInput value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="مثال: ميتفورمين" placeholderTextColor={t.muted} style={inputStyle} />
                  </View>

                  <View>
                    {label("الجرعة في كل مرة")}
                    <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                      {DOSES.map((d) => (
                        <Pressable key={d.value} onPress={() => setForm({ ...form, dose: d.value })} style={[chip(form.dose === d.value), { minWidth: 56 }]}>
                          <Text style={chipText(form.dose === d.value)}>{d.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      value={form.dose}
                      onChangeText={(v) => setForm({ ...form, dose: toEnglishDigits(v) })}
                      placeholder="أو اكتب أي كمية (مثال: 2.5)"
                      placeholderTextColor={t.muted}
                      keyboardType="decimal-pad"
                      style={inputStyle}
                    />
                  </View>

                  <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
                    {UNITS.map((u) => (
                      <Pressable key={u} onPress={() => setForm({ ...form, unit: u })} style={chip(form.unit === u)}>
                        <Text style={chipText(form.unit === u)}>{u}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <View>
                    {label("كام مرة في اليوم")}
                    <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
                      {FREQS.map((f) => (
                        <Pressable key={f.n} onPress={() => setCount(f.n)} style={chip(form.count === f.n)}>
                          <Text style={chipText(form.count === f.n)}>{f.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View>
                    {label("مواعيد التذكير")}
                    <View style={{ gap: 10 }}>
                      {form.slots.map((s, i) => (
                        <View key={i} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                          <Text style={{ width: 52, color: t.muted, fontFamily: TJ.medium, fontSize: 13, textAlign: "right" }}>{SLOT_NAMES[i]}</Text>
                          <TextInput
                            value={s.h}
                            onChangeText={(v) => patchSlot(i, { h: toEnglishDigits(v).replace(/[^\d]/g, "").slice(0, 2) })}
                            placeholder="س" placeholderTextColor={t.muted} keyboardType="number-pad" maxLength={2}
                            style={[inputStyle, { width: 62, textAlign: "center", paddingHorizontal: 4 }]}
                          />
                          <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 18 }}>:</Text>
                          <TextInput
                            value={s.m}
                            onChangeText={(v) => patchSlot(i, { m: toEnglishDigits(v).replace(/[^\d]/g, "").slice(0, 2) })}
                            placeholder="د" placeholderTextColor={t.muted} keyboardType="number-pad" maxLength={2}
                            style={[inputStyle, { width: 62, textAlign: "center", paddingHorizontal: 4 }]}
                          />
                          <View style={{ flexDirection: "row-reverse", gap: 6, flex: 1 }}>
                            {([["ص", false], ["م", true]] as const).map(([txt, pm]) => (
                              <Pressable key={txt} onPress={() => patchSlot(i, { pm })} style={[chip(s.pm === pm), { flex: 1, paddingHorizontal: 0, paddingVertical: 14 }]}>
                                <Text style={chipText(s.pm === pm)}>{txt}</Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </ScrollView>

                <View style={{ flexDirection: "row-reverse", gap: 10, padding: 16, paddingBottom: insets.bottom + 16, borderTopWidth: 1, borderTopColor: t.border }}>
                  <Pressable
                    onPress={save}
                    disabled={busy}
                    style={{ flex: 1, height: 54, borderRadius: 16, backgroundColor: t.gold, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}
                  >
                    <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 16 }}>{busy ? "جاري الحفظ..." : "حفظ"}</Text>
                  </Pressable>
                  {form.id ? (
                    <Pressable onPress={remove} style={{ height: 54, paddingHorizontal: 26, borderRadius: 16, borderWidth: 1.5, borderColor: t.destructive, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: t.destructive, fontFamily: TJ.heavy, fontSize: 16 }}>حذف</Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
