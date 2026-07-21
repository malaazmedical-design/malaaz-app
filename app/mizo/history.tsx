import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView,
  FlatList, Pressable, RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getLocalEvents, AacEvent } from "@/lib/mizoStorage";

function groupByDay(events: AacEvent[]): { date: string; items: AacEvent[] }[] {
  const map = new Map<string, AacEvent[]>();
  for (const e of events) {
    const day = e.created_at.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(e);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
}

export default function MizoHistoryScreen() {
  const [groups, setGroups] = useState<{ date: string; items: AacEvent[] }[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const events = await getLocalEvents();
    setGroups(groupByDay(events));
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-right" size={26} color="#C9A84C" />
        </Pressable>
        <Text style={styles.headerTitle}>سجل التواصل</Text>
        <View style={{ width: 34 }} />
      </View>

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>لسه مفيش كلام متسجل</Text>
          <Text style={styles.emptyDesc}>كل ما المريض يضغط كلمة هتتسجل هنا</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.date}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingVertical: 12 }}
          renderItem={({ item: group }) => (
            <View>
              <View style={styles.dayHeader}>
                <Text style={styles.dayText}>{formatDate(group.date)}</Text>
              </View>
              {group.items.map((ev) => (
                <View key={ev.id} style={[styles.eventRow, ev.is_emergency && styles.eventEmergency]}>
                  <Text style={styles.eventTime}>{formatTime(ev.created_at)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eventPhrase, ev.is_emergency && styles.emergencyText]}>
                      {ev.is_emergency && "🆘 "}
                      {ev.phrase}
                    </Text>
                    {ev.category && (
                      <Text style={styles.eventCat}>{ev.category}</Text>
                    )}
                  </View>
                  {ev.is_emergency && (
                    <MaterialCommunityIcons name="alert-circle" size={18} color="#CC2200" />
                  )}
                </View>
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7F6" },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1C2B2A",
  },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#C9A84C" },
  backBtn: { padding: 4 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#1C2B2A" },
  emptyDesc: { fontFamily: "Cairo_400Regular", fontSize: 13, color: "#7A8A89" },

  dayHeader: {
    backgroundColor: "#E8EDEC",
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 8,
  },
  dayText: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#1C2B2A", textAlign: "right" },

  eventRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E8EDEC",
    backgroundColor: "#fff",
  },
  eventEmergency: { backgroundColor: "#FFF5F5" },
  eventTime: { fontFamily: "Cairo_400Regular", fontSize: 12, color: "#7A8A89", minWidth: 50, textAlign: "center" },
  eventPhrase: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#1C2B2A", textAlign: "right" },
  emergencyText: { color: "#CC2200" },
  eventCat: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#7A8A89", textAlign: "right", marginTop: 2 },
});
