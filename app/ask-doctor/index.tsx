import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SkeletonCards } from "@/components/Skeleton";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { useApp } from "@/contexts/AppContext";
import { askStatus } from "@/lib/askStatus";
import { supabase, DbAskDoctorCase } from "@/lib/supabase";

export default function AskDoctorScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { client } = useApp();
  const [cases, setCases] = useState<DbAskDoctorCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const webTop = Platform.OS === "web" ? 67 : 0;

  const load = useCallback(async () => {
    if (!client?.id) { setCases([]); setLoading(false); setRefreshing(false); return; }
    const { data } = await supabase
      .from("ask_doctor_cases")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });
    setCases((data as DbAskDoctorCase[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [client?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // الرد بيوصل لحظيًا
  useEffect(() => {
    if (!client?.id) return;
    const ch = supabase.channel(`ask_list_${client.id}_${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ask_doctor_cases", filter: `client_id=eq.${client.id}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [client?.id, load]);

  const openNew = () => (client ? router.push("/ask-doctor/new") : router.push("/client-auth"));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top + 12 + webTop, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="رجوع" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="arrow-right" size={22} color={t.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 22, textAlign: "right" }}>إسأل طبيب</Text>
          <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13, textAlign: "right" }}>سؤال سريع · مجاني تمامًا</Text>
        </View>
      </View>

      {loading ? (
        <SkeletonCards count={4} />
      ) : (
        <FlatList
          data={cases}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={t.gold} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 70, paddingHorizontal: 30 }}>
              <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: t.ic, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="chat-question-outline" size={40} color={t.gold} />
              </View>
              <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 18, marginTop: 16, textAlign: "center" }}>
                {client ? "لسه ماسألتش حاجة" : "سجّل دخولك عشان تسأل"}
              </Text>
              <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, marginTop: 6, textAlign: "center", lineHeight: 22 }}>
                اكتب سؤالك أو وصف حالتك، وطبيب مختص هيرد عليك. السؤال مجاني.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const st = askStatus(item.status);
            const date = new Date(item.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
            return (
              <Pressable
                onPress={() => router.push(`/ask-doctor/${item.id}`)}
                style={({ pressed }) => ({ backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 20, padding: 14, transform: [{ scale: pressed ? 0.985 : 1 }] })}
              >
                <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 5, backgroundColor: st.color + "26", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <MaterialCommunityIcons name={st.icon} size={14} color={st.color} />
                    <Text style={{ color: st.color, fontFamily: TJ.bold, fontSize: 12.5 }}>{st.label}</Text>
                  </View>
                  <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5 }}>{date}</Text>
                </View>
                <Text numberOfLines={2} style={{ color: t.text, fontFamily: TJ.medium, fontSize: 14.5, lineHeight: 22, textAlign: "right", marginTop: 10 }}>{item.message}</Text>
              </Pressable>
            );
          }}
        />
      )}

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: insets.bottom + 16, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.border }}>
        <Pressable onPress={openNew} style={({ pressed }) => ({ height: 54, borderRadius: 18, backgroundColor: t.gold, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <MaterialCommunityIcons name="plus" size={22} color={t.onGold} />
          <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 16 }}>اسأل سؤال جديد</Text>
        </Pressable>
      </View>
    </View>
  );
}
