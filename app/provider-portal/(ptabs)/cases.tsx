import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useProvider } from "@/contexts/ProviderContext";
import { supabase, DbAskDoctorCase, DbAskDoctorMessage } from "@/lib/supabase";

const DARK = "#1C2B2A";
const GOLD = "#C9A84C";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  new:         { label: "جديد",       color: "#F59E0B" },
  accepted:    { label: "مقبول",      color: "#16A34A" },
  in_progress: { label: "جارية",      color: "#2563EB" },
  completed:   { label: "مكتملة",     color: "#6B7280" },
  cancelled:   { label: "ملغية",      color: "#DC2626" },
};

function CaseRow({ item, onPress }: { item: DbAskDoctorCase; onPress: () => void }) {
  const st = STATUS_LABEL[item.status] ?? STATUS_LABEL.new;
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
        borderColor: item.urgency_flag ? "#EF444444" : "#FFFFFF12",
      })}
    >
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
            {item.urgency_flag && <MaterialCommunityIcons name="alert-circle" size={14} color="#EF4444" />}
            <Text style={{ color: GOLD, fontFamily: "Cairo_600SemiBold", fontSize: 12 }}>{item.case_number ?? "—"}</Text>
          </View>
          <Text style={{ color: "#FFFFFFCC", fontFamily: "Cairo_400Regular", fontSize: 14, textAlign: "right", marginTop: 4 }} numberOfLines={2}>
            {item.message}
          </Text>
          {item.suggested_specialty && (
            <Text style={{ color: "#FFFFFF66", fontFamily: "Cairo_400Regular", fontSize: 12, marginTop: 2, textAlign: "right" }}>
              {item.suggested_specialty}
            </Text>
          )}
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

function Bubble({ msg, isMe }: { msg: DbAskDoctorMessage; isMe: boolean }) {
  const time = new Date(msg.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  return (
    <View style={{ alignItems: isMe ? "flex-end" : "flex-start", marginBottom: 10, paddingHorizontal: 16 }}>
      <View style={{
        backgroundColor: isMe ? GOLD : "#FFFFFF15",
        borderRadius: 16,
        borderBottomRightRadius: isMe ? 4 : 16,
        borderBottomLeftRadius: isMe ? 16 : 4,
        padding: 12,
        maxWidth: "80%",
      }}>
        <Text style={{ color: isMe ? DARK : "#FFFFFFEE", fontFamily: "Cairo_400Regular", fontSize: 14, lineHeight: 22 }}>
          {msg.content}
        </Text>
      </View>
      <Text style={{ color: "#FFFFFF44", fontFamily: "Cairo_400Regular", fontSize: 10, marginTop: 3 }}>{time}</Text>
    </View>
  );
}

function CaseModal({
  item,
  doctorId,
  onClose,
}: {
  item: DbAskDoctorCase | null;
  doctorId: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [caseData, setCaseData] = useState<DbAskDoctorCase | null>(item);
  const [messages, setMessages] = useState<DbAskDoctorMessage[]>([]);
  const [text, setText] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const canChat = caseData && (caseData.status === "accepted" || caseData.status === "in_progress");
  const isMyCase = caseData?.assigned_doctor_id === doctorId;

  const loadMessages = useCallback(async () => {
    if (!caseData?.id) return;
    const { data } = await supabase.from("ask_doctor_messages").select("*").eq("case_id", caseData.id).order("created_at", { ascending: true });
    setMessages((data as DbAskDoctorMessage[]) ?? []);
  }, [caseData?.id]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (!caseData?.id) return;
    const channel = supabase.channel(`doc_case_${caseData.id}_${Date.now()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ask_doctor_cases", filter: `id=eq.${caseData.id}` }, (p) => {
        setCaseData((prev) => prev ? { ...prev, ...(p.new as DbAskDoctorCase) } : (p.new as DbAskDoctorCase));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ask_doctor_messages", filter: `case_id=eq.${caseData.id}` }, (p) => {
        setMessages((prev) => [...prev, p.new as DbAskDoctorMessage]);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [caseData?.id]);

  const acceptCase = async () => {
    if (!caseData?.id) return;
    setAccepting(true);
    const { error } = await supabase
      .from("ask_doctor_cases")
      .update({ status: "accepted", assigned_doctor_id: doctorId })
      .eq("id", caseData.id)
      .eq("status", "new");
    if (error) {
      Alert.alert("خطأ", "لم يتمكن من قبول الحالة — ربما قبلها طبيب آخر");
    } else {
      setCaseData((prev) => prev ? { ...prev, status: "accepted", assigned_doctor_id: doctorId } : prev);
    }
    setAccepting(false);
  };

  const completeCase = async () => {
    if (!caseData?.id) return;
    await supabase.from("ask_doctor_cases").update({ status: "completed" }).eq("id", caseData.id);
    setCaseData((prev) => prev ? { ...prev, status: "completed" } : prev);
  };

  const sendMessage = async () => {
    if (!text.trim() || !caseData?.id) return;
    setSending(true);
    const content = text.trim();
    setText("");
    await supabase.from("ask_doctor_messages").insert({
      case_id: caseData.id,
      sender_id: doctorId,
      sender_type: "doctor",
      content,
    });
    setSending(false);
  };

  if (!caseData) return null;
  const st = STATUS_LABEL[caseData.status] ?? STATUS_LABEL.new;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: DARK }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header */}
        <View style={{ paddingTop: insets.top + 12, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#FFFFFF10" }}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
            <Pressable onPress={onClose} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "#FFFFFF15", alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name="arrow-right" size={22} color="#FFFFFFCC" />
            </Pressable>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={{ color: GOLD, fontFamily: "Cairo_700Bold", fontSize: 17 }}>{caseData.case_number ?? "استشارة"}</Text>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 3 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: st.color }} />
                <Text style={{ color: st.color, fontFamily: "Cairo_600SemiBold", fontSize: 12 }}>{st.label}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Case message */}
        <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: "#FFFFFF0A", borderRadius: 14, padding: 14 }}>
          {caseData.urgency_flag && (
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <MaterialCommunityIcons name="alert-circle" size={14} color="#EF4444" />
              <Text style={{ color: "#EF4444", fontFamily: "Cairo_600SemiBold", fontSize: 12 }}>أعراض تستدعي الانتباه</Text>
            </View>
          )}
          <Text style={{ color: "#FFFFFFCC", fontFamily: "Cairo_400Regular", fontSize: 14, textAlign: "right", lineHeight: 22 }}>
            {caseData.message}
          </Text>
          {caseData.suggested_specialty && (
            <Text style={{ color: GOLD, fontFamily: "Cairo_600SemiBold", fontSize: 12, textAlign: "right", marginTop: 8 }}>
              التخصص المقترح: {caseData.suggested_specialty}
            </Text>
          )}
          {caseData.patient_name && (
            <Text style={{ color: "#FFFFFF66", fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right", marginTop: 4 }}>
              المريض: {caseData.patient_name}
            </Text>
          )}
        </View>

        {/* Accept / Complete buttons */}
        {caseData.status === "new" && (
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row-reverse", gap: 12 }}>
            <Pressable
              onPress={acceptCase}
              disabled={accepting}
              style={{ flex: 1, backgroundColor: "#16A34A", borderRadius: 14, paddingVertical: 14, alignItems: "center" }}
            >
              {accepting ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text style={{ color: "#fff", fontFamily: "Cairo_700Bold", fontSize: 15 }}>قبول الحالة</Text>
              )}
            </Pressable>
            <Pressable
              onPress={onClose}
              style={{ flex: 1, backgroundColor: "#FFFFFF15", borderRadius: 14, paddingVertical: 14, alignItems: "center" }}
            >
              <Text style={{ color: "#FFFFFFCC", fontFamily: "Cairo_700Bold", fontSize: 15 }}>رجوع</Text>
            </Pressable>
          </View>
        )}

        {isMyCase && (caseData.status === "accepted" || caseData.status === "in_progress") && (
          <Pressable
            onPress={completeCase}
            style={{ marginHorizontal: 16, marginBottom: 4, backgroundColor: "#6B728020", borderRadius: 14, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#6B728040" }}
          >
            <Text style={{ color: "#6B7280", fontFamily: "Cairo_600SemiBold", fontSize: 13 }}>إنهاء الاستشارة</Text>
          </Pressable>
        )}

        {/* Chat */}
        {canChat && isMyCase ? (
          <>
            <FlatList
              ref={flatRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={{ paddingVertical: 12 }}
              onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => <Bubble msg={item} isMe={item.sender_id === doctorId} />}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingTop: 30 }}>
                  <Text style={{ color: "#FFFFFF44", fontFamily: "Cairo_400Regular", fontSize: 13 }}>ابدأ المحادثة مع المريض</Text>
                </View>
              }
            />
            <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12, paddingTop: 10, flexDirection: "row-reverse", alignItems: "flex-end", gap: 10, borderTopWidth: 1, borderTopColor: "#FFFFFF10" }}>
              <Pressable
                onPress={sendMessage}
                disabled={sending || !text.trim()}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? GOLD : "#FFFFFF22", alignItems: "center", justifyContent: "center" }}
              >
                {sending ? <ActivityIndicator color={DARK} size="small" /> : <MaterialCommunityIcons name="send" size={20} color={text.trim() ? DARK : "#FFFFFF55"} />}
              </Pressable>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="اكتب رسالة..."
                placeholderTextColor="#FFFFFF44"
                multiline
                textAlign="right"
                style={{ flex: 1, backgroundColor: "#FFFFFF0D", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: "#FFFFFFEE", fontFamily: "Cairo_400Regular", fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: "#FFFFFF15" }}
              />
            </View>
          </>
        ) : (
          canChat && !isMyCase ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#FFFFFF44", fontFamily: "Cairo_400Regular", fontSize: 14 }}>هذه الحالة مع طبيب آخر</Text>
            </View>
          ) : null
        )}

        {caseData.status === "completed" && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name="check-circle" size={56} color="#16A34A" />
            <Text style={{ color: "#FFFFFFCC", fontFamily: "Cairo_600SemiBold", fontSize: 16, marginTop: 12 }}>اكتملت الاستشارة</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function DoctorCasesScreen() {
  const insets = useSafeAreaInsets();
  const { provider } = useProvider();
  const [cases, setCases] = useState<DbAskDoctorCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<DbAskDoctorCase | null>(null);
  const doctorId = provider?.id ?? "";

  const load = useCallback(async () => {
    if (!provider?.id) { setLoading(false); return; }
    const { data } = await supabase
      .from("ask_doctor_cases")
      .select("*")
      .or(`status.eq.new,assigned_doctor_id.eq.${provider.id}`)
      .order("created_at", { ascending: false });
    setCases((data as DbAskDoctorCase[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [provider?.id]);

  useEffect(() => { load(); }, [load]);

  // Realtime: new cases
  useEffect(() => {
    if (!provider?.id) return;
    const channel = supabase.channel(`doctor_cases_feed_${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ask_doctor_cases" }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider?.id, load]);

  const newCount = cases.filter((c) => c.status === "new").length;

  return (
    <View style={{ flex: 1, backgroundColor: DARK }}>
      <View style={{ paddingTop: insets.top + 16, paddingBottom: 18, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#FFFFFF10" }}>
        <Text style={{ color: GOLD, fontFamily: "Cairo_700Bold", fontSize: 22, textAlign: "right" }}>استشارات المرضى</Text>
        <Text style={{ color: "#FFFFFF66", fontFamily: "Cairo_400Regular", fontSize: 13, textAlign: "right", marginTop: 2 }}>
          {newCount > 0 ? `${newCount} طلب جديد ينتظر` : "لا توجد طلبات جديدة"}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={GOLD} />
        </View>
      ) : (
        <FlatList
          data={cases}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GOLD} />
          }
          renderItem={({ item }) => (
            <CaseRow item={item} onPress={() => setSelected(item)} />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <MaterialCommunityIcons name="stethoscope" size={56} color="#FFFFFF22" />
              <Text style={{ color: "#FFFFFF55", fontFamily: "Cairo_600SemiBold", fontSize: 16, marginTop: 12 }}>لا يوجد استشارات</Text>
            </View>
          }
        />
      )}

      {selected && (
        <CaseModal
          item={selected}
          doctorId={doctorId}
          onClose={() => { setSelected(null); load(); }}
        />
      )}
    </View>
  );
}
