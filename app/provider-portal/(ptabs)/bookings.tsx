import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Modal, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CasesPanel, useDoctorCases } from "./cases";
import { PText, SwipeButton, useCheckBurst } from "@/components/provider/PUI";
import { PAYMENT_METHOD_LABELS } from "@/constants/data";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { useProvider } from "@/contexts/ProviderContext";
import { BState, PERIOD_LABEL, STATE_META, dateLabelOf, maskPhone, periodOf, shortName, stateOf } from "@/lib/providerFmt";
import { DbBooking, supabase } from "@/lib/supabase";

const FILTERS: { k: BState | "all"; name: string }[] = [
  { k: "all", name: "الكل" },
  { k: "new", name: "جديد" },
  { k: "confirmed", name: "مؤكد" },
  { k: "onway", name: "في الطريق" },
  { k: "done", name: "مكتمل" },
  { k: "cancelled", name: "ملغي" },
];

const CANCEL_REASONS = ["العميل لا يرد", "العنوان غير صحيح أو بعيد", "ظرف طارئ لدي", "سبب آخر"];
const NOTES_KEY = "malaz.provider.notesSent.v1";

type Review = { booking_id: string | null; client_name: string | null; rating: number | null; text: string | null };

function mapsUrl(b: DbBooking): string {
  if (b.lat != null && b.lng != null) return `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.address, b.area].filter(Boolean).join(" "))}`;
}

export default function ProviderBookingsScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { focus, t: focusNonce } = useLocalSearchParams<{ focus?: string; t?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const listY = useRef(0);
  const cardY = useRef<Record<string, number>>({});
  const pendingScroll = useRef<string | null>(null);
  const tryScroll = () => {
    const id = pendingScroll.current;
    if (!id) return;
    const y = cardY.current[id];
    if (y == null) return;
    pendingScroll.current = null;
    scrollRef.current?.scrollTo({ y: Math.max(0, listY.current + y - 12), animated: true });
  };
  const { provider, bookings, loadingBookings, refreshAll, updateBookingStatus, setOnWay, sendVisitNote } = useProvider();
  const burst = useCheckBurst();
  const cs = useDoctorCases();
  const isDoctor = (provider?.service_type ?? "").includes("كشف");
  const [section, setSection] = useState<"bookings" | "cases">("bookings");

  const [filter, setFilter] = useState<BState | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<DbBooking | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [reviews, setReviews] = useState<Review[]>([]);

  // فتح حجز معيّن (من النظرة العامة أو من إشعار): نفتح تفاصيله وننزل عليه
  useEffect(() => {
    if (!focus) return;
    setSection("bookings");
    setFilter("all");
    setOpen(String(focus));
    pendingScroll.current = String(focus);
    const id = setTimeout(tryScroll, 150);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, focusNonce]);

  useEffect(() => {
    AsyncStorage.getItem(NOTES_KEY).then((v) => v && setSent(new Set(JSON.parse(v)))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!provider?.id) return;
    // approved reviews only (RLS/is_approved) — booking_id column exists on the test project only
    supabase.from("reviews").select("*").eq("provider_id", provider.id).eq("is_approved", true)
      .then(({ data }) => setReviews((data ?? []) as Review[]), () => {});
  }, [provider?.id, bookings.length]);

  const rows = useMemo(() => bookings.map((b) => ({ b, s: stateOf(b) })), [bookings]);
  const counts = (k: BState | "all") => (k === "all" ? rows.length : rows.filter((r) => r.s === k).length);
  const shown = rows.filter((r) => filter === "all" || r.s === filter);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    try { await fn(); if (ok) burst.show(ok); } catch (e: any) { Alert.alert("خطأ", e.message ?? "تعذر التحديث"); }
  };

  const markSent = (id: string) => {
    const next = new Set(sent); next.add(id); setSent(next);
    AsyncStorage.setItem(NOTES_KEY, JSON.stringify([...next])).catch(() => {});
  };

  const doCancel = (reason: string) => {
    const b = cancelFor; setCancelFor(null);
    if (b) run(() => updateBookingStatus(b.id, "cancelled", reason));
  };

  const link = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={section === "cases" ? cs.refreshing : loadingBookings} onRefresh={section === "cases" ? cs.refresh : refreshAll} tintColor={t.gold} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
          <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 24, textAlign: "right" }}>حجوزاتي</PText>
          <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "right", marginTop: 2 }}>
            {section === "cases" ? "أسئلة العملاء واستشاراتهم" : "كل حجوزاتك وحالتها"}
          </PText>
        </View>

        {isDoctor ? (
          <View style={{ flexDirection: "row-reverse", marginHorizontal: 16, marginBottom: 12, padding: 4, borderRadius: 18, backgroundColor: t.card, borderWidth: 1, borderColor: t.border }}>
            {([["bookings", "الحجوزات", 0], ["cases", "الاستشارات", cs.newCount]] as const).map(([k, name, n]) => {
              const on = section === k;
              return (
                <Pressable key={k} onPress={() => setSection(k)}
                  style={{ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 14, backgroundColor: on ? t.gold : "transparent" }}>
                  <PText style={{ color: on ? t.onGold : t.text2, fontFamily: TJ.heavy, fontSize: 14.5 }}>{name}</PText>
                  {n > 0 ? (
                    <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: on ? t.onGold : t.gold, alignItems: "center", justifyContent: "center" }}>
                      <PText style={{ color: on ? t.gold : t.onGold, fontFamily: TJ.heavy, fontSize: 12 }}>{n}</PText>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {section === "cases" && isDoctor ? <CasesPanel state={cs} /> : (<>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", gap: 8, paddingHorizontal: 16 }}>
          {FILTERS.map((f) => {
            const on = filter === f.k;
            return (
              <Pressable key={f.k} onPress={() => setFilter(f.k)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: on ? t.gold : t.card, borderWidth: 1, borderColor: on ? t.gold : t.border }}>
                <PText style={{ color: on ? t.onGold : t.text2, fontFamily: TJ.bold, fontSize: 14 }}>{f.name} ({counts(f.k)})</PText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ paddingHorizontal: 16, gap: 10, marginTop: 14 }} onLayout={(e) => { listY.current = e.nativeEvent.layout.y; tryScroll(); }}>
          {shown.map(({ b, s }) => {
            const m = STATE_META[s];
            const isOpen = open === b.id;
            const pay = b.payment_method ? PAYMENT_METHOD_LABELS[b.payment_method] ?? b.payment_method : "—";
            const wa = `https://wa.me/20${(b.phone ?? "").replace(/\D/g, "").replace(/^0/, "")}`;
            const closed = s === "done" || s === "cancelled";
            const remote = !b.address && !b.area && b.lat == null;
            const review = reviews.find((r) => (r.booking_id && r.booking_id === b.id) || (!r.booking_id && r.client_name === b.patient_name));
            const price = b.price != null && b.price !== "" ? `${b.price} ج.م` : null;
            return (
              <View key={b.id} onLayout={(e) => { cardY.current[b.id] = e.nativeEvent.layout.y; tryScroll(); }} style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 22, padding: 14 }}>
                <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <PText numberOfLines={1} style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15.5, textAlign: "right" }}>{shortName(b.patient_name)}</PText>
                    {closed ? null : <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, marginTop: 2, textAlign: "right", writingDirection: "ltr" }}>{maskPhone(b.phone)}</PText>}
                  </View>
                  <View style={{ backgroundColor: m.color + "26", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <PText style={{ color: m.color, fontFamily: TJ.bold, fontSize: 12.5 }}>{m.label}</PText>
                  </View>
                </View>
                <PText style={{ color: t.text, fontFamily: TJ.medium, fontSize: 14, marginTop: 10, textAlign: "right", lineHeight: 21 }}>{b.sub_option ?? b.service_type}</PText>
                <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 6, gap: 10 }}>
                  <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, flex: 1, textAlign: "right" }}>
                    {dateLabelOf(b.appointment_time)} · {PERIOD_LABEL[periodOf(b.appointment_time)]} · {b.area ?? "—"}
                  </PText>
                  {price ? <PText style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 16 }}>{price}</PText> : null}
                </View>

                {isOpen ? (
                  <View style={{ marginTop: 12, backgroundColor: t.ic, borderRadius: 16, padding: 12, gap: 6 }}>
                    <Line t={t} k="الاسم" v={b.patient_name} />
                    {closed ? <Line t={t} k="الموبايل" v="مخفي بعد انتهاء الحجز" /> : <Line t={t} k="الموبايل" v={b.phone} ltr />}
                    {!remote ? (
                      <Pressable onPress={() => link(mapsUrl(b))}
                        style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, marginVertical: 4, padding: 10, borderRadius: 14, backgroundColor: t.card, borderWidth: 1, borderColor: t.border }}>
                        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: t.goldTint, alignItems: "center", justifyContent: "center" }}>
                          <MaterialCommunityIcons name="map-marker-outline" size={19} color={t.gold} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right" }}>
                            {b.lat != null ? "الموقع الذي حدده العميل" : "الموقع من العنوان"}
                          </PText>
                          <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 14, textAlign: "right", lineHeight: 21 }}>{[b.address, b.area].filter(Boolean).join("، ")}</PText>
                        </View>
                        <PText style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 12.5 }}>افتح الخريطة ←</PText>
                      </Pressable>
                    ) : <Line t={t} k="الموقع" v="خدمة عن بُعد" />}
                    <Line t={t} k="رقم الحجز" v={`MLZ-${b.id.slice(-4).toUpperCase()}`} ltr />
                    <Line t={t} k="الموعد" v={`${dateLabelOf(b.appointment_time)} · ${PERIOD_LABEL[periodOf(b.appointment_time)]}`} />
                    <Line t={t} k="الدفع" v={pay} />
                    {b.notes ? <Line t={t} k="ملاحظات المريض" v={b.notes} /> : null}
                    {s === "cancelled" && b.cancel_reason ? (
                      <PText style={{ color: t.destructive, fontFamily: TJ.heavy, fontSize: 14, textAlign: "right" }}>سبب الإلغاء: {b.cancel_reason}</PText>
                    ) : null}
                    {s === "done" ? (
                      <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "right" }}>
                        تقييم العميل:{" "}
                        <PText style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 14 }}>
                          {review ? `${"★".repeat(review.rating ?? 5)}${review.text ? ` — ${review.text}` : ""}` : "قيد مراجعة الإدارة"}
                        </PText>
                      </PText>
                    ) : null}
                    {s === "done" ? (
                      sent.has(b.id) ? (
                        <PText style={{ color: t.online, fontFamily: TJ.heavy, fontSize: 14, textAlign: "right", marginTop: 6 }}>✓ أُرسلت ملاحظتك للإدارة</PText>
                      ) : (
                        <View style={{ marginTop: 8 }}>
                          <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "right" }}>ملاحظة بعد الزيارة · تصل للإدارة فقط</PText>
                          <TextInput
                            value={notes[b.id] ?? ""}
                            onChangeText={(v) => setNotes((p) => ({ ...p, [b.id]: v }))}
                            multiline placeholder="اكتب ملاحظتك" placeholderTextColor={t.muted}
                            style={{ marginTop: 6, minHeight: 64, borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, color: t.text, padding: 10, fontSize: 14, fontFamily: TJ.medium, textAlign: "right", textAlignVertical: "top" }}
                          />
                          <Pressable
                            onPress={() => {
                              const v = (notes[b.id] ?? "").trim();
                              if (!v) return;
                              run(async () => { await sendVisitNote(b.id, v); markSent(b.id); }, "أُرسلت الملاحظة");
                            }}
                            style={({ pressed }) => ({ marginTop: 8, alignItems: "center", padding: 10, borderRadius: 12, backgroundColor: t.gold, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                            <PText style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 14 }}>إرسال للإدارة</PText>
                          </Pressable>
                        </View>
                      )
                    ) : null}
                    {!closed ? <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 8 }}>
                      <Pressable onPress={() => link(`tel:${b.phone}`)} style={{ flex: 1, alignItems: "center", padding: 9, borderRadius: 12, backgroundColor: t.btn }}>
                        <PText style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 14 }}>اتصال</PText>
                      </Pressable>
                      <Pressable onPress={() => link(wa)} style={{ flex: 1, alignItems: "center", padding: 9, borderRadius: 12, backgroundColor: "rgba(37,211,102,.14)" }}>
                        <PText style={{ color: t.whatsapp, fontFamily: TJ.heavy, fontSize: 14 }}>واتساب</PText>
                      </Pressable>
                    </View> : <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginTop: 6 }}>🔒 بيانات التواصل بتتخفى بعد انتهاء الحجز لحماية خصوصية العميل</PText>}
                  </View>
                ) : null}

                <View style={{ marginTop: 12, gap: 8 }}>
                  {s === "new" ? <SwipeButton label="اسحب للقبول" onConfirm={() => run(() => updateBookingStatus(b.id, "confirmed"), "تم قبول الحجز")} /> : null}
                  {s === "confirmed" ? <SwipeButton label="اسحب: أنا في الطريق" onConfirm={() => run(() => setOnWay(b.id))} /> : null}
                  {s === "onway" ? <SwipeButton label="اسحب: اكتملت الزيارة" onConfirm={() => run(() => updateBookingStatus(b.id, "completed"), "تم اكتمال الحجز")} /> : null}
                  <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                    <Pressable onPress={() => setOpen(isOpen ? null : b.id)}
                      style={({ pressed }) => ({ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: t.border, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                      <PText style={{ color: t.text2, fontFamily: TJ.bold, fontSize: 14 }}>{isOpen ? "إخفاء" : "التفاصيل"}</PText>
                    </Pressable>
                    {s === "new" || s === "confirmed" || s === "onway" ? (
                      <Pressable onPress={() => setCancelFor(b)}
                        style={({ pressed }) => ({ width: 64, alignItems: "center", paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: "rgba(229,72,77,.5)", transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                        <PText style={{ color: t.destructive, fontFamily: TJ.bold, fontSize: 14 }}>إلغاء</PText>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
          {shown.length === 0 ? (
            <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "center", paddingVertical: 50 }}>لا توجد حجوزات في هذه الحالة</PText>
          ) : null}
        </View>
        </>)}
      </ScrollView>

      <Modal visible={!!cancelFor} transparent animationType="fade" onRequestClose={() => setCancelFor(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,.55)", justifyContent: "flex-end" }} onPress={() => setCancelFor(null)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: t.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: insets.bottom + 20, gap: 10 }}>
            <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 18, textAlign: "right" }}>سبب الإلغاء</PText>
            <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "right", marginBottom: 4 }}>اختر السبب، وسيصل للإدارة.</PText>
            {CANCEL_REASONS.map((r) => (
              <Pressable key={r} onPress={() => doCancel(r)} style={({ pressed }) => ({ padding: 15, borderRadius: 16, backgroundColor: pressed ? t.btn : t.ic })}>
                <PText style={{ color: t.text, fontFamily: TJ.bold, fontSize: 15, textAlign: "right" }}>{r}</PText>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
      {burst.node}
    </View>
  );
}

function Line({ t, k, v, ltr }: { t: ReturnType<typeof useMalaz>; k: string; v: string | null; ltr?: boolean }) {
  return (
    <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "right", lineHeight: 22 }}>
      {k}: <PText style={{ color: t.text, fontFamily: TJ.medium, fontSize: 14, writingDirection: ltr ? "ltr" : "rtl" }}>{v ?? "—"}</PText>
    </PText>
  );
}
