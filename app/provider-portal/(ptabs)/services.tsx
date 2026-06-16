import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/ui";
import { useProvider } from "@/contexts/ProviderContext";
import { useColors } from "@/hooks/useColors";
import { DbSubService } from "@/lib/supabase";

const DARK = "#1C2B2A";
const GOLD = "#C9A84C";

type RowState = { checked: boolean; price: string };

function rangeFor(sub: DbSubService, grade: string | null) {
  const consultant = grade === "استشاري";
  const min = (consultant ? sub.price_min_consultant : sub.price_min_specialist) ?? sub.price_min ?? 0;
  const max = (consultant ? sub.price_max_consultant : sub.price_max_specialist) ?? sub.price_max ?? 0;
  return { min, max };
}

export default function ProviderServicesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { provider, subServices, myServices, loadingBookings, refreshAll, saveMyServices } = useProvider();
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);

  const svcType = provider?.service_type || "كشف منزلي";
  const subs = subServices.filter((s) => s.service_name === svcType && s.group_name !== "grade");

  useEffect(() => {
    const next: Record<string, RowState> = {};
    for (const sub of subs) {
      const existing = myServices.find((m) => m.sub_service_id === sub.id);
      next[sub.id] = {
        checked: !!existing,
        price: existing?.custom_price != null ? String(existing.custom_price) : "",
      };
    }
    setRows(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myServices, subServices, provider?.service_type]);

  const handleSave = async () => {
    const toSave: { sub_service_id: string; custom_price: number | null }[] = [];
    for (const sub of subs) {
      const row = rows[sub.id];
      if (!row?.checked) continue;
      const { min, max } = rangeFor(sub, provider?.grade ?? null);
      const price = row.price ? parseFloat(row.price) : null;
      if (price != null && (price < min || price > max)) {
        Alert.alert("تنبيه", `سعر "${sub.name}" يجب أن يكون بين ${min} و ${max} ج.م`);
        return;
      }
      toSave.push({ sub_service_id: sub.id, custom_price: price });
    }
    setSaving(true);
    try {
      await saveMyServices(toSave);
      Alert.alert("تم", "✅ تم حفظ خدماتك وأسعارك");
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: DARK, paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 20 }}>
        <Text style={{ color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 18, textAlign: "right" }}>خدماتي وأسعاري</Text>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right", marginTop: 2 }}>
          {svcType} — فعّل الخدمات التي تقدمها وحدد سعرك ضمن نطاق الأدمن
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 30 }}
        refreshControl={<RefreshControl refreshing={loadingBookings} onRefresh={refreshAll} />}
      >
        {subs.length === 0 ? (
          <View style={{ alignItems: "center", padding: 50 }}>
            <Text style={{ fontSize: 32, marginBottom: 10 }}>🔧</Text>
            <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 13, color: colors.mutedForeground, textAlign: "center" }}>
              لم يتم إضافة خدمات فرعية لـ "{svcType}" بعد{"\n"}يقوم الأدمن بإضافتها
            </Text>
          </View>
        ) : (
          <>
            {subs.map((sub) => {
              const row = rows[sub.id] ?? { checked: false, price: "" };
              const { min, max } = rangeFor(sub, provider?.grade ?? null);
              const priceNum = row.price ? parseFloat(row.price) : null;
              const invalid = priceNum != null && (priceNum < min || priceNum > max);
              return (
                <View
                  key={sub.id}
                  style={{
                    backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10,
                    borderWidth: 1.5, borderColor: row.checked ? "rgba(201,168,76,0.4)" : colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 14, color: colors.foreground, textAlign: "right" }}>{sub.name}</Text>
                      {sub.duration ? (
                        <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 11, color: colors.mutedForeground, textAlign: "right" }}>
                          <MaterialCommunityIcons name="clock-outline" size={10} /> {sub.duration}
                        </Text>
                      ) : null}
                    </View>
                    <Switch
                      value={row.checked}
                      onValueChange={(v) => setRows((p) => ({ ...p, [sub.id]: { ...row, checked: v } }))}
                      trackColor={{ false: "#ccc", true: "#43A047" }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 11, color: colors.mutedForeground, textAlign: "right", marginTop: 6 }}>
                    نطاق الأدمن: <Text style={{ color: "#b8860b", fontFamily: "Cairo_700Bold" }}>{min} – {max} ج.م</Text>
                  </Text>

                  {row.checked ? (
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <Text style={{ fontFamily: "Cairo_600SemiBold", fontSize: 12, color: colors.mutedForeground }}>سعرك (ج.م):</Text>
                      <TextInput
                        value={row.price}
                        onChangeText={(t) => setRows((p) => ({ ...p, [sub.id]: { ...row, price: t.replace(/[^\d.]/g, "") } }))}
                        placeholder={String(min)}
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="numeric"
                        style={{
                          width: 90, padding: 8, borderRadius: 8, textAlign: "center",
                          borderWidth: 1.5, borderColor: invalid ? "#DC2626" : GOLD,
                          fontFamily: "Cairo_600SemiBold", fontSize: 13, color: colors.foreground,
                          backgroundColor: colors.surfaceMuted,
                        }}
                      />
                      {invalid ? (
                        <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 11, color: "#DC2626", flex: 1, textAlign: "right" }}>
                          بين {min} و {max}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}

            <PrimaryButton
              label={saving ? "جاري الحفظ..." : "حفظ خدماتي وأسعاري"}
              icon="content-save"
              onPress={handleSave}
              loading={saving}
              style={{ marginTop: 8 }}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}
