import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { supabase, DbAskDoctorCase, DbAskDoctorMessage } from "@/lib/supabase";

const DARK = "#1C2B2A";
const GOLD = "#C9A84C";

const STATUS_LABEL: Record<string, { label: string; color: string; icon: string }> = {
  new:         { label: "جاري البحث عن طبيب...", color: "#F59E0B", icon: "clock-outline" },
  accepted:    { label: "طبيب قبل الحالة",         color: "#16A34A", icon: "check-circle" },
  in_progress: { label: "جلسة جارية",              color: "#2563EB", icon: "chat-processing" },
  completed:   { label: "اكتملت الاستشارة",         color: "#6B7280", icon: "check-all" },
  cancelled:   { label: "ملغية",                   color: "#DC2626", icon: "close-circle" },
};

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
        {!isMe && msg.sender_type === "doctor" && (
          <Text style={{ color: GOLD, fontFamily: "Cairo_600SemiBold", fontSize: 11, marginBottom: 4 }}>الطبيب</Text>
        )}
        <Text style={{ color: isMe ? DARK : "#FFFFFFEE", fontFamily: "Cairo_400Regular", fontSize: 14, lineHeight: 22 }}>
          {msg.content}
        </Text>
      </View>
      <Text style={{ color: "#FFFFFF44", fontFamily: "Cairo_400Regular", fontSize: 10, marginTop: 3 }}>{time}</Text>
    </View>
  );
}

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { client } = useApp();
  const [caseData, setCaseData] = useState<DbAskDoctorCase | null>(null);
  const [messages, setMessages] = useState<DbAskDoctorMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const canChat = caseData && (caseData.status === "accepted" || caseData.status === "in_progress");
  const myId = client?.id ?? "";

  const loadCase = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("ask_doctor_cases").select("*").eq("id", id).single();
    if (data) setCaseData(data as DbAskDoctorCase);
    setLoading(false);
  }, [id]);

  const loadMessages = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("ask_doctor_messages")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: true });
    setMessages((data as DbAskDoctorMessage[]) ?? []);
  }, [id]);

  useEffect(() => {
    loadCase();
    loadMessages();
  }, [loadCase, loadMessages]);

  // Realtime: case status changes
  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`ask_case_${id}_${Date.now()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ask_doctor_cases", filter: `id=eq.${id}` }, (p) => {
        setCaseData((prev) => prev ? { ...prev, ...(p.new as DbAskDoctorCase) } : (p.new as DbAskDoctorCase));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ask_doctor_messages", filter: `case_id=eq.${id}` }, (p) => {
        setMessages((prev) => [...prev, p.new as DbAskDoctorMessage]);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const sendMessage = async () => {
    if (!text.trim() || !id || !client) return;
    setSending(true);
    const content = text.trim();
    setText("");
    await supabase.from("ask_doctor_messages").insert({
      case_id: id,
      sender_id: client.id,
      sender_type: "patient",
      content,
    });
    setSending(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: DARK, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }

  const st = STATUS_LABEL[caseData?.status ?? "new"];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: DARK }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 12, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#FFFFFF10" }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "#FFFFFF15", alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name="arrow-right" size={22} color="#FFFFFFCC" />
          </Pressable>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={{ color: GOLD, fontFamily: "Cairo_700Bold", fontSize: 17 }}>
              {caseData?.case_number ?? "استشارة"}
            </Text>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 3 }}>
              <MaterialCommunityIcons name={st.icon as any} size={14} color={st.color} />
              <Text style={{ color: st.color, fontFamily: "Cairo_600SemiBold", fontSize: 12 }}>{st.label}</Text>
            </View>
          </View>
        </View>
        {caseData?.suggested_specialty && (
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 10 }}>
            <MaterialCommunityIcons name="medical-bag" size={14} color="#FFFFFF55" />
            <Text style={{ color: "#FFFFFF66", fontFamily: "Cairo_400Regular", fontSize: 12 }}>{caseData.suggested_specialty}</Text>
          </View>
        )}
      </View>

      {/* Case message summary */}
      {caseData && (
        <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: "#FFFFFF0A", borderRadius: 14, padding: 14 }}>
          <Text style={{ color: "#FFFFFF88", fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right", lineHeight: 20 }} numberOfLines={3}>
            {caseData.message}
          </Text>
        </View>
      )}

      {/* Waiting state */}
      {caseData?.status === "new" && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
          <ActivityIndicator color={GOLD} size="large" />
          <Text style={{ color: "#FFFFFFCC", fontFamily: "Cairo_600SemiBold", fontSize: 16, marginTop: 20, textAlign: "center" }}>
            جاري البحث عن طبيب متاح
          </Text>
          <Text style={{ color: "#FFFFFF55", fontFamily: "Cairo_400Regular", fontSize: 13, marginTop: 8, textAlign: "center" }}>
            سيصلك إشعار عند قبول طبيب لطلبك
          </Text>
        </View>
      )}

      {/* Chat */}
      {canChat && (
        <>
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingVertical: 12, paddingBottom: 8 }}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <Bubble msg={item} isMe={item.sender_id === myId} />
            )}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingTop: 40 }}>
                <Text style={{ color: "#FFFFFF44", fontFamily: "Cairo_400Regular", fontSize: 13 }}>
                  ابدأ المحادثة مع الطبيب
                </Text>
              </View>
            }
          />
          {/* Input */}
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
      )}

      {/* Completed state */}
      {caseData?.status === "completed" && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
          <MaterialCommunityIcons name="check-circle" size={56} color="#16A34A" />
          <Text style={{ color: "#FFFFFFCC", fontFamily: "Cairo_600SemiBold", fontSize: 16, marginTop: 16, textAlign: "center" }}>
            اكتملت الاستشارة
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
