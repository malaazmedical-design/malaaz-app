import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { useProvider } from "@/contexts/ProviderContext";
import { useColors } from "@/hooks/useColors";
import { DbBooking } from "@/lib/supabase";
import { PAYMENT_METHOD_LABELS } from "@/constants/data";

const GOLD = "#C9A84C";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "جديد", color: "#F59E0B" },
  confirmed: { label: "مؤكد", color: "#3B82F6" },
  completed: { label: "مكتمل", color: "#16A34A" },
  cancelled: { label: "ملغي", color: "#DC2626" },
};

export function BookingCard({ booking, compact }: { booking: DbBooking; compact?: boolean }) {
  const colors = useColors();
  const { updateBookingStatus, setOnWay } = useProvider();
  const [detailOpen, setDetailOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleOnWay = () => {
    Alert.alert("في الطريق 🚗", "هيوصل العميل إشعار إنك اتحركت ناحيته. تأكيد؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "أيوة، اتحركت",
        onPress: async () => {
          setBusy(true);
          try {
            await setOnWay(booking.id);
          } catch (e: any) {
            Alert.alert("خطأ", e.message ?? "تعذر التحديث");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const st = STATUS_MAP[booking.status] ?? { label: booking.status, color: colors.mutedForeground };

  const doUpdate = async (status: "confirmed" | "completed" | "cancelled", confirmMsg: string) => {
    Alert.alert("تأكيد", confirmMsg, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "نعم",
        onPress: async () => {
          setBusy(true);
          try {
            await updateBookingStatus(booking.id, status);
            setDetailOpen(false);
          } catch (e: any) {
            Alert.alert("خطأ", e.message ?? "تعذر التحديث");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const ActionButtons = ({ inModal }: { inModal?: boolean }) => (
    <View style={{ flexDirection: "row-reverse", gap: 6, flexWrap: "wrap", marginTop: inModal ? 16 : 10 }}>
      {booking.status === "pending" ? (
        <ActBtn label="قبول" color="#16A34A" icon="check" disabled={busy} onPress={() => doUpdate("confirmed", "قبول هذا الحجز؟ سيتم إخطار العميل.")} />
      ) : null}
      {booking.status === "confirmed" && !booking.on_way_at ? (
        <ActBtn label="في الطريق 🚗" color="#7C3AED" icon="truck-fast" disabled={busy} onPress={handleOnWay} />
      ) : null}
      {booking.status === "confirmed" && booking.on_way_at ? (
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: "#7C3AED14", borderWidth: 1, borderColor: "#7C3AED30", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 }}>
          <Text style={{ color: "#7C3AED", fontFamily: "Cairo_700Bold", fontSize: 12 }}>🚗 في الطريق ✓</Text>
        </View>
      ) : null}
      {booking.status === "confirmed" ? (
        <ActBtn label="مكتمل" color="#16A34A" icon="check-all" disabled={busy} onPress={() => doUpdate("completed", "تعيين الحجز كمكتمل؟ سيُفتح واتساب لإرسال رابط التقييم للعميل.")} />
      ) : null}
      {booking.status !== "cancelled" && booking.status !== "completed" ? (
        <ActBtn label="رفض" color="#DC2626" icon="close" disabled={busy} onPress={() => doUpdate("cancelled", "رفض هذا الحجز؟ سيتم إخطار العميل.")} />
      ) : null}
      {!inModal ? (
        <ActBtn label="التفاصيل" color="#3B82F6" icon="eye" onPress={() => setDetailOpen(true)} />
      ) : null}
    </View>
  );

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 14, color: colors.foreground, textAlign: "right" }}>
            {booking.patient_name}{"  "}
            <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }}>{booking.phone}</Text>
          </Text>
          <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 12, color: colors.mutedForeground, textAlign: "right", marginTop: 2 }}>
            {booking.service_type}{booking.sub_option ? ` — ${booking.sub_option}` : ""}
          </Text>
          <Text style={{ fontFamily: "Cairo_400Regular", fontSize: 11, color: colors.mutedForeground, textAlign: "right", marginTop: 2 }}>
            <MaterialCommunityIcons name="clock-outline" size={10} /> {booking.appointment_time ?? "—"} · {booking.area ?? "—"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-start" }}>
          <View style={{ backgroundColor: `${st.color}18`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
            <Text style={{ color: st.color, fontFamily: "Cairo_700Bold", fontSize: 11 }}>{st.label}</Text>
          </View>
          {booking.payment_method ? (
            <Text style={{ fontSize: 10, color: colors.mutedForeground, fontFamily: "Cairo_400Regular", marginTop: 6 }}>
              {PAYMENT_METHOD_LABELS[booking.payment_method] ?? booking.payment_method}
            </Text>
          ) : null}
        </View>
      </View>

      {!compact ? <ActionButtons /> : (
        <Pressable onPress={() => setDetailOpen(true)} style={{ marginTop: 8 }}>
          <Text style={{ fontFamily: "Cairo_600SemiBold", fontSize: 12, color: GOLD, textAlign: "left" }}>التفاصيل ←</Text>
        </Pressable>
      )}

      {/* ─── Detail Modal ─── */}
      <Modal visible={detailOpen} transparent animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={() => setDetailOpen(false)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%" }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={{ fontFamily: "Cairo_700Bold", fontSize: 16, color: colors.foreground }}>تفاصيل الحجز</Text>
                <Pressable onPress={() => setDetailOpen(false)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name="close" size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>

              <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 }}>
                <DetailField label="المريض" value={booking.patient_name} />
                <DetailField label="الموبايل" value={booking.phone} />
                <DetailField label="الخدمة" value={booking.service_type} />
                <DetailField label="التفصيل" value={booking.sub_option ?? "—"} />
                <DetailField label="المنطقة" value={booking.area ?? "—"} />
                <DetailField label="الوقت" value={booking.appointment_time ?? "—"} />
                <DetailField label="العنوان" value={booking.address ?? "—"} wide />
                <DetailField label="الدفع" value={booking.payment_method ? (PAYMENT_METHOD_LABELS[booking.payment_method] ?? booking.payment_method) : "—"} />
                <DetailField label="الحالة" value={st.label} />
                {booking.price ? <DetailField label="السعر" value={`${booking.price} ج.م`} /> : null}
                {booking.notes ? <DetailField label="ملاحظات" value={booking.notes} wide /> : null}
              </View>

              <ActionButtons inModal />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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

function ActBtn({ label, color, icon, onPress, disabled }: { label: string; color: string; icon: any; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: `${color}14`, borderWidth: 1, borderColor: `${color}30`, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, opacity: disabled ? 0.5 : 1 }}
    >
      <MaterialCommunityIcons name={icon} size={13} color={color} />
      <Text style={{ color, fontFamily: "Cairo_700Bold", fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}
