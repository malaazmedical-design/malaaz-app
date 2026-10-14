import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Modal, ScrollView, Platform, Pressable, RefreshControl, View } from "react-native";
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
  const [sort, setSort] = useState<"rating" | "price" | null>(null);
  const [sheet, setSheet] = useState(false);
  const [specOpen, setSpecOpen] = useState(false);
  type Flt = { spec: string | null; chan: "all" | "chat" | "voice" | "video"; avail: boolean; sort: "rating" | "price" | null };
  const [pend, setPend] = useState<Flt>({ spec: null, chan: "all", avail: false, sort: null });
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
    if (!sort) return l;
    return [...l].sort((a, b) => sort === "rating" ? b.rating - a.rating : (lowestOnline(offers[a.id]) ?? 0) - (lowestOnline(offers[b.id]) ?? 0));
  }, [docs, q, spec, chan, onlyAvail, sort, offers]);

  const previewCount = (f: { spec: string | null; chan: string; avail: boolean }) => {
    const nq = normalizeArabic(q.trim());
    return docs.filter((p) =>
      (!nq || normalizeArabic(p.name).includes(nq) || normalizeArabic(p.title).includes(nq)) &&
      (!f.spec || p.title.includes(f.spec)) &&
      (f.chan === "all" || offers[p.id]?.[f.chan as "chat" | "voice" | "video"] != null) &&
      (!f.avail || p.available)).length;
  };

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
      <View style={{ flexDirection: "row-reverse", gap: 8, marginHorizontal: 16, marginBottom: 10 }}>
        {([["free", "سؤال مجاني"], ["online", "استشارة أونلاين"], ["mine", "أسئلتي"]] as const).map(([k, name]) => {
          const on = tab === k;
          return (
            <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, alignItems: "center", justifyContent: "center", height: 50, borderRadius: 25, backgroundColor: on ? t.goldTint : t.card, borderWidth: 1.5, borderColor: on ? t.gold : t.border }}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: on ? t.goldText : t.text, fontFamily: TJ.heavy, fontSize: 14, paddingHorizontal: 6 }}>{name}</Text>
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
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, height: 50, borderRadius: 16, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, paddingHorizontal: 14 }}>
              <MaterialCommunityIcons name="magnify" size={22} color={t.muted} />
              <TextInput value={q} onChangeText={setQ} placeholder="ابحث بالاسم أو التخصص..." placeholderTextColor={t.muted} textAlign="right"
                style={{ flex: 1, color: t.text, fontFamily: TJ.medium, fontSize: 14.5 }} />
            </View>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
              <Pressable onPress={() => { setPend({ spec, chan, avail: onlyAvail, sort }); setSpecOpen(false); setSheet(true); }}
                style={{ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 16, backgroundColor: t.goldTint, borderWidth: 1, borderColor: t.goldRing }}>
                <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 16 }}>التصفية</Text>
                {(spec ? 1 : 0) + (chan !== "all" ? 1 : 0) + (onlyAvail ? 1 : 0) + (sort ? 1 : 0) > 0 ? (
                  <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: t.gold, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
                    <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 12 }}>{(spec ? 1 : 0) + (chan !== "all" ? 1 : 0) + (onlyAvail ? 1 : 0) + (sort ? 1 : 0)}</Text>
                  </View>
                ) : null}
                <MaterialCommunityIcons name="chevron-down" size={22} color={t.goldText} />
              </Pressable>
              <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13 }}>{shownDocs.length} نتيجة</Text>
            </View>
          </View>
          <FlatList
            data={shownDocs}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 12 }}
            ListEmptyComponent={<Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "center", paddingTop: 50 }}>لا يوجد أطباء مطابقين الآن</Text>}
            renderItem={({ item: p }) => {
              const o = offers[p.id];
              const open = () => router.push(`/provider/${p.id}?online=1`);
              return (
                <Pressable onPress={open}
                  style={({ pressed }) => ({ padding: 14, borderRadius: 22, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
                    <View>
                      <ProviderAvatar provider={p} style={{ width: 64, height: 64, borderRadius: 14 }} letterSize={28} />
                      <View style={{ position: "absolute", bottom: -3, left: -3, width: 14, height: 14, borderRadius: 7, backgroundColor: p.available ? t.online : t.offline, borderWidth: 2, borderColor: t.card }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 16, textAlign: "right" }}>{p.name}</Text>
                      <Text numberOfLines={1} style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginTop: 2 }}>{p.title} · {p.city}</Text>
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 5, marginTop: 4 }}>
                        <MaterialCommunityIcons name="star" size={14} color={t.gold} />
                        <Text style={{ color: t.text, fontFamily: TJ.bold, fontSize: 13 }}>{p.rating.toFixed(1)}</Text>
                        <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5 }}>· {p.yearsExperience} سنة خبرة</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-start" }}>
                      <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 11.5 }}>ابتداء من</Text>
                      <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 19 }}>{lowestOnline(o)} ج.م</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 12 }}>
                    {([["chat", "شات", "email-outline"], ["voice", "صوت", "phone-outline"], ["video", "فيديو", "video-outline"]] as const).map(([k, label, icon]) =>
                      o?.[k] != null ? (
                        <Pressable key={k} onPress={open} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: t.ic }}>
                          <MaterialCommunityIcons name={icon} size={16} color={t.goldText} />
                          <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 13.5 }}>{label}</Text>
                        </Pressable>
                      ) : null,
                    )}
                  </View>
                </Pressable>
              );
            }}
          />

          <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,.55)", justifyContent: "flex-end" }}>
              <Pressable style={{ flex: 1 }} onPress={() => setSheet(false)} />
              <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "88%", paddingBottom: insets.bottom + 12 }}>
                <View style={{ alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: t.border, marginTop: 10 }} />
                <ScrollView contentContainerStyle={{ padding: 20, gap: 8 }}>
                  <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 21, textAlign: "center", marginBottom: 8 }}>تصفية الأطباء</Text>

                  <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15, textAlign: "right" }}>التخصص</Text>
                  <Pressable onPress={() => setSpecOpen((v) => !v)} style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", height: 52, borderRadius: 16, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, paddingHorizontal: 16 }}>
                    <Text style={{ color: t.text, fontFamily: TJ.medium, fontSize: 15 }}>{pend.spec ?? "كل التخصصات"}</Text>
                    <MaterialCommunityIcons name={specOpen ? "chevron-up" : "chevron-down"} size={22} color={t.muted} />
                  </Pressable>
                  {specOpen ? (
                    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, overflow: "hidden" }}>
                      {[null, ...specs].map((sp) => (
                        <Pressable key={sp ?? "all"} onPress={() => { setPend((x) => ({ ...x, spec: sp })); setSpecOpen(false); }}
                          style={{ paddingVertical: 13, paddingHorizontal: 16, backgroundColor: pend.spec === sp ? t.goldTint : "transparent" }}>
                          <Text style={{ color: pend.spec === sp ? t.goldText : t.text, fontFamily: TJ.bold, fontSize: 14.5, textAlign: "right" }}>{sp ?? "كل التخصصات"}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15, textAlign: "right", marginTop: 14 }}>طريقة الاستشارة</Text>
                  <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
                    {([["all", "الكل"], ["chat", "شات"], ["voice", "صوت"], ["video", "فيديو"]] as const).map(([k, name]) => {
                      const on = pend.chan === k;
                      return (
                        <Pressable key={k} onPress={() => setPend((x) => ({ ...x, chan: k }))} style={{ paddingHorizontal: 20, paddingVertical: 11, borderRadius: 18, backgroundColor: on ? t.goldTint : t.card, borderWidth: 1.5, borderColor: on ? t.gold : t.border }}>
                          <Text style={{ color: on ? t.goldText : t.text2, fontFamily: TJ.heavy, fontSize: 14.5 }}>{name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15, textAlign: "right", marginTop: 14 }}>التوفر</Text>
                  <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                    {([[false, "الكل"], [true, "متاح الآن"]] as const).map(([v, name]) => {
                      const on = pend.avail === v;
                      return (
                        <Pressable key={name} onPress={() => setPend((x) => ({ ...x, avail: v }))} style={{ paddingHorizontal: 20, paddingVertical: 11, borderRadius: 18, backgroundColor: on ? t.goldTint : t.card, borderWidth: 1.5, borderColor: on ? t.gold : t.border }}>
                          <Text style={{ color: on ? t.goldText : t.text2, fontFamily: TJ.heavy, fontSize: 14.5 }}>{name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15, textAlign: "right", marginTop: 14 }}>الترتيب</Text>
                  <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                    {([["price", "الأقل سعرًا"], ["rating", "الأعلى تقييمًا"]] as const).map(([k, name]) => {
                      const on = pend.sort === k;
                      return (
                        <Pressable key={k} onPress={() => setPend((x) => ({ ...x, sort: on ? null : k }))} style={{ paddingHorizontal: 20, paddingVertical: 11, borderRadius: 18, backgroundColor: on ? t.goldTint : t.card, borderWidth: 1.5, borderColor: on ? t.gold : t.border }}>
                          <Text style={{ color: on ? t.goldText : t.text2, fontFamily: TJ.heavy, fontSize: 14.5 }}>{name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 20 }}>
                    <Pressable onPress={() => setPend({ spec: null, chan: "all", avail: false, sort: null })}
                      style={{ flex: 1, height: 54, borderRadius: 18, borderWidth: 1.5, borderColor: t.border, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15 }}>إعادة ضبط</Text>
                    </Pressable>
                    <Pressable onPress={() => { setSpec(pend.spec); setChan(pend.chan); setOnlyAvail(pend.avail); setSort(pend.sort); setSheet(false); }}
                      style={{ flex: 1.6, height: 54, borderRadius: 18, backgroundColor: t.gold, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 16 }}>عرض {previewCount(pend)} طبيب</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>
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
