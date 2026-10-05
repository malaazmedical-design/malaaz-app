import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { supabase, DbAskDoctorCase } from "@/lib/supabase";

const DARK = "#1C2B2A";
const GOLD = "#C9A84C";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new:        { label: "جاري البحث",    color: "#F59E0B" },
  accepted:   { label: "طبيب متاح",     color: "#16A34A" },
  in_progress:{ label: "جلسة جارية",    color: "#2563EB" },
  completed:  { label: "مكتملة",         color: "#6B7280" },
  cancelled:  { label: "ملغية",          color: "#DC2626" },
};

function CaseCard({ item, onPress }: { item: DbAskDoctorCase; onPress: () => void }) {
  const st = STATUS_MAP[item.status] ?? STATUS_MAP.new;
  const date = new Date(item.created_at).toLocaleDateString("ar-EG", { day: "2-digit", month: "short" });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? "#FFFFFF08" : "#FFFFFF0D",
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#FFFFFF12",
      })}
    >
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
            {item.urgency_flag && (
              <MaterialCommunityIcons name="alert-circle" size={16} color="#EF4444" />
            )}
            <Text style={{ color: GOLD, fontFamily: "Cairo_600SemiBold", fontSize: 13 }}>
              {item.case_number ?? "جديد"}
            </Text>
          </View>
          <Text
            style={{ color: "#FFFFFFCC", fontFamily: "Cairo_400Regular", fontSize: 14, textAlign: "right", marginTop: 4 }}
            numberOfLines={2}
          >
            {item.message}
          </Text>
          {item.suggested_specialty ? (
            <Text style={{ color: "#FFFFFF66", fontFamily: "Cairo_400Regular", fontSize: 12, marginTop: 2, textAlign: "right" }}>
              {item.suggested_specialty}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 8, marginRight: 12 }}>
          <View style={{ backgroundColor: st.color + "22", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: st.color, fontFamily: "Cairo_600SemiBold", fontSize: 11 }}>{st.label}</Text>
          </View>
          <Text style={{ color: "#FFFFFF44", fontFamily: "Cairo_400Regular", fontSize: 11 }}>{date}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function AskDoctorScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { client } = useApp();
  const [cases, setCases] = useState<DbAskDoctorCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const webTop = Platform.OS === "web" ? 67 : 0;

  const load = useCallback(async () => {
    if (!client?.id) { setLoading(false); return; }
    const { data } = await supabase
      .from("ask_doctor_cases")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });
    setCases((data as DbAskDoctorCase[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [client?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: DARK }}>
      {/* Header */}
      <View style={{ backgroundColor: DARK, paddingTop: insets.top + 16 + webTop, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: GOLD, fontFamily: "Cairo_700Bold", fontSize: 22, textAlign: "right" }}>إسأل طبيب</Text>
            <Text style={{ color: "#FFFFFF66", fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "right", marginTop: 2 }}>
              استشاراتك الطبية في مكان واحد
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/ask-doctor/new")}
            style={{ backgroundColor: GOLD, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row-reverse", alignItems: "center", gap: 6 }}
          >
            <MaterialCommunityIcons name="plus" size={18} color={DARK} />
            <Text style={{ color: DARK, fontFamily: "Cairo_700Bold", fontSize: 14 }}>طلب جديد</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={GOLD} />
        </View>
      ) : cases.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
          <MaterialCommunityIcons name="stethoscope" size={64} color="#FFFFFF22" />
          <Text style={{ color: "#FFFFFF88", fontFamily: "Cairo_600SemiBold", fontSize: 18, marginTop: 16, textAlign: "center" }}>
            لا يوجد استشارات بعد
          </Text>
          <Text style={{ color: "#FFFFFF44", fontFamily: "Cairo_400Regular", fontSize: 14, marginTop: 8, textAlign: "center" }}>
            اكتب سؤالك أو صف حالتك وهنوصّلك لأقرب طبيب متاح
          </Text>
        </View>
      ) : (
        <FlatList
          data={cases}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GOLD} />
          }
          renderItem={({ item }) => (
            <CaseCard item={item} onPress={() => router.push(`/ask-doctor/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}
