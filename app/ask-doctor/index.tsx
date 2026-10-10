import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, ScrollView, Platform, Pressable, RefreshControl, View } from "react-native";
import { Text, TextInput } from "@/components/i18n";
import { ProviderAvatar } from "@/components/ProviderAvatar";
import { AskForm } from "@/components/ask/AskForm";
import { normalizeArabic } from "@/constants/data";
import { lowestOnline, useOnlineOffers } from "@/lib/useOnlineOffers";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SkeletonCards } from "@/components/Skeleton";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { useApp } from "@/contexts/AppContext";
import { askStatus } from "@/lib/askStatus";
import { supabase, DbAskDoctorCase } from "@/lib/supabase";

import { locale } from "@/lib/i18n";
export default function AskDoctorScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { client, providers } = useApp();
  const offers = useOnlineOffers();
  const [tab, setTab] = useState<"free" | "online" | "mine">("free");
  const [toast, setToast] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [spec, setSpec] = useState<string | null>(null);
  const [chan, setChan] = useState<"all" | "chat" | "voice" | "video">("all");
  const [onlyAvail, setOnlyAvail] = useState(false);
  const [sort, setSort] = useState<"rating" | "price">("rating");
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

  const docs = React.useMemo(() => providers.filter((p) => p.serviceType === "doctor" && offers[p.id] && lowestOnline(offers[p.id]) != null), [providers, offers]);
  const specs = React.useMemo(() => [...new Set(docs.map((p) => p.title.replace(/^(أخصائي|استشاري)\s+/, "")).filter(Boolean))], [docs]);
  const shownDocs = React.useMemo(() => {
    let l = docs;
    const nq = normalizeArabic(q.trim());
    if (nq) l = l.filter((p) => normalizeArabic(p.name).includes(nq) || normalizeArabic(p.title).includes(nq));
    if (spec) l = l.filter((p) => p.title.includes(spec));
    if (chan !== "all") l = l.filter((p) => offers[p.id]?.[chan] != null);
    if (onlyAvail) l = l.filter((p) => p.available);
    return [...l].sort((a, b) => sort === "rating" ? b.rating - a.rating : (lowestOnline(offers[a.id]) ?? 0) - (lowestOnline(offers[b.id]) ?? 0));
  }, [docs, q, spec, chan, onlyAvail, sort, offers]);

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

      {/* tabs */}
      <View style={{ flexDirection: "row-reverse", marginHorizontal: 16, marginBottom: 8, backgroundColor: t.card, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: t.border }}>
        {([["free", "سؤال مجاني"], ["online", "استشارة أونلاين"], ["mine", "أسئلتي"]] as const).map(([k, name]) => {
          const on = tab === k;
          return (
            <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, backgroundColor: on ? t.gold : "transparent" }}>
              <Text style={{ color: on ? t.onGold : t.text2, fontFamily: TJ.heavy, fontSize: 13.5 }}>{name}</Text>
            </Pressable>
          );
        })}
      </View>

      {toast ? (
        <View style={{ position: "absolute", top: insets.top + 74, left: 24, right: 24, zIndex: 20, backgroundColor: t.gold, borderRadius: 14, paddingVertical: 12, alignItems: "center" }}>
          <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 14 }}>{toast}</Text>
        </View>
      ) : null}

      {tab === "free" ? (
        <AskForm
          onSent={() => { setTab("mine"); load(); setToast("تم إرسال سؤالك"); setTimeout(() => setToast(null), 2500); }}
          bottomInset={insets.bottom}
        />
      ) : null}

      {tab === "online" ? (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, gap: 8 }}>
            <TextInput value={q} onChangeText={setQ} placeholder="ابحث باسم الطبيب أو التخصص" placeholderTextColor={t.muted} textAlign="right"
              style={{ height: 46, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, color: t.text, paddingHorizontal: 14, fontFamily: TJ.medium, fontSize: 14 }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", gap: 8 }}>
              {([["all", "كل القنوات"], ["chat", "شات"], ["voice", "صوت"], ["video", "فيديو"]] as const).map(([k, name]) => (
                <Pressable key={k} onPress={() => setChan(k)} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: chan === k ? t.gold : t.card, borderWidth: 1, borderColor: chan === k ? t.gold : t.border }}>
                  <Text style={{ color: chan === k ? t.onGold : t.text2, fontFamily: TJ.bold, fontSize: 13 }}>{name}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setOnlyAvail((v) => !v)} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: onlyAvail ? t.gold : t.card, borderWidth: 1, borderColor: onlyAvail ? t.gold : t.border }}>
                <Text style={{ color: onlyAvail ? t.onGold : t.text2, fontFamily: TJ.bold, fontSize: 13 }}>متاح الآن</Text>
              </Pressable>
              <Pressable onPress={() => setSort((v) => (v === "rating" ? "price" : "rating"))} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: t.card, borderWidth: 1, borderColor: t.border }}>
                <Text style={{ color: t.text2, fontFamily: TJ.bold, fontSize: 13 }}>{sort === "rating" ? "الأعلى تقييمًا" : "الأقل سعرًا"}</Text>
              </Pressable>
            </ScrollView>
            {specs.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", gap: 8 }}>
                {specs.map((sp) => (
                  <Pressable key={sp} onPress={() => setSpec(spec === sp ? null : sp)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: spec === sp ? t.goldTint : t.ic, borderWidth: 1.5, borderColor: spec === sp ? t.gold : "transparent" }}>
                    <Text style={{ color: spec === sp ? t.goldText : t.text2, fontFamily: TJ.bold, fontSize: 12.5 }}>{sp}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>
          <FlatList
            data={shownDocs}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 10 }}
            ListEmptyComponent={<Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "center", paddingTop: 50 }}>لا يوجد أطباء مطابقين الآن</Text>}
            renderItem={({ item: p }) => {
              const o = offers[p.id];
              return (
                <Pressable onPress={() => router.push(`/provider/${p.id}?online=1`)}
                  style={({ pressed }) => ({ flexDirection: "row-reverse", alignItems: "center", gap: 12, padding: 12, borderRadius: 20, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                  <View>
                    <ProviderAvatar provider={p} style={{ width: 60, height: 60, borderRadius: 14 }} letterSize={26} />
                    <View style={{ position: "absolute", bottom: -3, left: -3, width: 14, height: 14, borderRadius: 7, backgroundColor: p.available ? t.online : t.offline, borderWidth: 2, borderColor: t.card }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15, textAlign: "right" }}>{p.name}</Text>
                    <Text numberOfLines={1} style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12, textAlign: "right", marginTop: 2 }}>{p.title}</Text>
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 5 }}>
                      <MaterialCommunityIcons name="star" size={13} color={t.gold} />
                      <Text style={{ color: t.text, fontFamily: TJ.bold, fontSize: 12.5 }}>{p.rating.toFixed(1)}</Text>
                      <MaterialCommunityIcons name="chat-outline" size={13} color={t.gold} />
                      {o?.voice != null ? <MaterialCommunityIcons name="phone-outline" size={13} color={t.gold} /> : null}
                      {o?.video != null ? <MaterialCommunityIcons name="video-outline" size={13} color={t.gold} /> : null}
                      <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 12.5 }}>من {lowestOnline(o)} ج.م</Text>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        </View>
      ) : null}

      {tab === "mine" ? (
        loading ? (
          <SkeletonCards count={4} />
        ) : (
          <FlatList
            data={cases}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 10 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={t.gold} />}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingTop: 70, paddingHorizontal: 30 }}>
                <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: t.ic, alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name="chat-question-outline" size={40} color={t.gold} />
                </View>
                <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 18, marginTop: 16, textAlign: "center" }}>
                  {client ? "لم ترسل أسئلة بعد" : "سجّل دخولك عشان تسأل"}
                </Text>
                <Pressable onPress={() => setTab("free")} style={{ marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14, backgroundColor: t.goldTint }}>
                  <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 14 }}>اسأل سؤالك الآن</Text>
                </Pressable>
              </View>
            }
            renderItem={({ item }) => {
            const st = askStatus(item.status);
            const date = new Date(item.created_at).toLocaleDateString(locale(), { day: "numeric", month: "short" });
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
        )
      ) : null}
    </View>
  );
}
