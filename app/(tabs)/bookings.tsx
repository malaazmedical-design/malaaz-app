import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert, Modal, Platform, Pressable, ScrollView, Text, View, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, EmptyState, Pill, PrimaryButton } from "@/components/ui";
import { PAYMENT_METHOD_LABELS } from "@/constants/data";
import { whatsappCompany } from "@/lib/contact";
import { Booking, useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  pending:   { label: "قيد المراجعة", color: "#F59E0B", icon: "clock-outline" },
  confirmed: { label: "مؤكد",         color: "#16A34A", icon: "check-circle" },
  completed: { label: "مكتمل",        color: "#6B7280", icon: "check-all" },
  cancelled: { label: "ملغي",         color: "#DC2626", icon: "close-circle" },
};

export default function BookingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { bookings, loadingBookings, cancelBooking, refreshBookings, profile } = useApp();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const handleCancel = (booking: Booking) => {
    const doCancel = async () => {
      try {
        await cancelBooking(booking.id);
      } catch {
        Alert.alert("خطأ", "تعذّر إلغاء الحجز، حاول مرة أخرى");
      }
    };
    if (Platform.OS === "web") { doCancel(); return; }
    Alert.alert("إلغاء الحجز", "هل تريد فعلاً إلغاء هذا الحجز؟", [
      { text: "تراجع", style: "cancel" },
      { text: "نعم، إلغاء", style: "destructive", onPress: doCancel },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: "#1C2B2A", paddingTop: insets.top + 16 + webTopInset, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: "#C9A84C", fontFamily: "Cairo_700Bold", fontSize: 22, textAlign: "right" }}>حجوزاتي</Text>
            <Text style={{ color: "#FFFFFF66", fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "right", marginTop: 2 }}>
              تابع طلباتك وحجوزاتك
            </Text>
          </View>
          <Pressable onPress={refreshBookings} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#FFFFFF15", alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name="refresh" size={20} color="#C9A84C" />
          </Pressable>
        </View>
      </View>

      {!profile.phone ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <MaterialCommunityIcons name="account-outline" size={56} color={colors.mutedForeground} />
          <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 18, textAlign: "center", marginTop: 16 }}>
            سجّل بياناتك أولاً
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 14, textAlign: "center", marginTop: 8 }}>
            ادخل اسمك ورقم هاتفك من حسابي عشان تتابع حجوزاتك
          </Text>
          <View style={{ marginTop: 24, width: "100%" }}>
            <PrimaryButton label="اذهب لحسابي" icon="account" onPress={() => router.push("/profile")} />
          </View>
        </View>
      ) : loadingBookings ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#C9A84C" />
          <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", marginTop: 12 }}>جاري تحميل الحجوزات...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {bookings.length === 0 ? (
            <View style={{ paddingTop: 40 }}>
              <EmptyState
                icon="calendar-blank-outline"
                title="لا يوجد حجوزات حتى الآن"
                message="ابدأ بطلب خدمة طبية منزلية من الصفحة الرئيسية"
              />
            </View>
          ) : (
            bookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} onCancel={handleCancel} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function BookingCard({ booking, onCancel }: { booking: Booking; onCancel: (b: Booking) => void }) {
  const colors = useColors();
  const [detailOpen, setDetailOpen] = useState(false);
  const status = STATUS_MAP[booking.status] ?? STATUS_MAP.pending;
  const canCancel = booking.status === "pending" || booking.status === "confirmed";
  const canRate = booking.status === "completed" && !booking.review && booking.provider_id;

  const date =
    booking.appointment_time ??
    new Date(booking.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Card style={{ padding: 16 }}>
      {/* Status + Date */}
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: `${status.color}18`, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}>
          <MaterialCommunityIcons name={status.icon as any} size={14} color={status.color} />
          <Text style={{ color: status.color, fontFamily: "Cairo_600SemiBold", fontSize: 12 }}>{status.label}</Text>
        </View>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 12 }}>{date}</Text>
      </View>

      {/* Service Info */}
      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#1C2B2A", alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="medical-bag" size={22} color="#C9A84C" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 15, textAlign: "right" }}>
            {booking.sub_option ?? booking.service_type}
          </Text>
          {booking.providerName ? (
            <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right", marginTop: 2 }}>
              {booking.providerName}
            </Text>
          ) : (
            <Text style={{ color: "#F59E0B", fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right", marginTop: 2 }}>
              جاري تعيين المزود...
            </Text>
          )}
        </View>
      </View>

      {/* Details */}
      <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {booking.area ? <Pill label={booking.area} icon="map-marker" /> : null}
        {booking.payment_method ? (
          <Pill label={PAYMENT_METHOD_LABELS[booking.payment_method] ?? booking.payment_method} icon="cash" />
        ) : null}
        {booking.price ? (
          <Pill label={`${booking.price} ج.م`} icon="tag" />
        ) : null}
      </View>

      {/* Actions */}
      <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 4 }}>
        <Pressable
          onPress={() => setDetailOpen(true)}
          style={{ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#1C2B2A", paddingVertical: 10, borderRadius: 12 }}
        >
          <MaterialCommunityIcons name="eye" size={16} color="#C9A84C" />
          <Text style={{ color: "#C9A84C", fontFamily: "Cairo_600SemiBold", fontSize: 13 }}>عرض</Text>
        </Pressable>
      </View>
      {(canCancel || canRate) ? (
        <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 8 }}>
          {canRate ? (
            <Pressable
              onPress={() => router.push(`/rate/${booking.id}`)}
              style={{ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#C9A84C", paddingVertical: 10, borderRadius: 12 }}
            >
              <MaterialCommunityIcons name="star" size={16} color="#1C2B2A" />
              <Text style={{ color: "#1C2B2A", fontFamily: "Cairo_600SemiBold", fontSize: 13 }}>قيّم الخدمة</Text>
            </Pressable>
          ) : null}
          {canCancel ? (
            <Pressable
              onPress={() => onCancel(booking)}
              style={{ flex: canRate ? 0 : 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#FEE2E2", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 }}
            >
              <MaterialCommunityIcons name="close" size={16} color="#DC2626" />
              <Text style={{ color: "#DC2626", fontFamily: "Cairo_600SemiBold", fontSize: 13 }}>إلغاء</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* ─── Booking Details Modal ─── */}
      <Modal visible={detailOpen} transparent animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={() => setDetailOpen(false)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "82%" }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 16, color: colors.foreground }}>تفاصيل الحجز</Text>
                <Pressable onPress={() => setDetailOpen(false)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name="close" size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>

              <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 }}>
                <DetailField label="الخدمة" value={booking.service_type} />
                <DetailField label="التفصيل" value={booking.sub_option ?? "—"} />
                <DetailField label="الحالة" value={status.label} />
                <DetailField label="الموعد" value={booking.appointment_time ?? "أسرع وقت ممكن"} />
                <DetailField label="الاسم" value={booking.patient_name} />
                <DetailField label="الهاتف" value={booking.phone} />
                <DetailField label="العنوان" value={booking.address ?? "—"} wide />
                {booking.area ? <DetailField label="المنطقة" value={booking.area} /> : null}
                <DetailField label="الدفع" value={booking.payment_method ? (PAYMENT_METHOD_LABELS[booking.payment_method] ?? booking.payment_method) : "—"} />
                {booking.price ? <DetailField label="السعر" value={`${booking.price} ج.م`} /> : null}
                {booking.providerName ? <DetailField label="مقدم الخدمة" value={booking.providerName} /> : null}
                {booking.notes ? <DetailField label="ملاحظات" value={booking.notes} wide /> : null}
                <DetailField label="رقم الحجز" value={`#${booking.id.slice(-6).toUpperCase()}`} />
                <DetailField label="تاريخ الطلب" value={new Date(booking.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })} />
              </View>

              {/* استفسار واتساب برسالة جاهزة عن الحجز ده تحديداً */}
              <Pressable
                onPress={() =>
                  whatsappCompany(
                    `مرحباً، عندي استفسار عن حجزي رقم #${booking.id.slice(-6).toUpperCase()}\n` +
                      `الخدمة: ${booking.service_type}${booking.sub_option ? ` — ${booking.sub_option}` : ""}\n` +
                      `الموعد: ${booking.appointment_time ?? "أسرع وقت ممكن"}`
                  )
                }
                style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#25D366", padding: 14, borderRadius: 14, marginTop: 16 }}
              >
                <MaterialCommunityIcons name="whatsapp" size={20} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 14 }}>استفسار عن الحجز على واتساب</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Card>
  );
}

function DetailField({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  const colors = useColors();
  return (
    <View style={{ width: wide ? "100%" : "47%", backgroundColor: colors.surfaceMuted, borderRadius: 10, padding: 10 }}>
      <Text style={{ fontSize: 10, fontFamily: "Cairo_600SemiBold", color: colors.mutedForeground, textAlign: "right" }}>{label}</Text>
      <Text style={{ fontSize: 13, fontFamily: "Cairo_700Bold", color: colors.foreground, textAlign: "right", marginTop: 2 }}>{value}</Text>
    </View>
  );
}
