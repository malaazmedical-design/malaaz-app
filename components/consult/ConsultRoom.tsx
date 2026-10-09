import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CallPanel } from "@/components/consult/CallPanel";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { endAt, fmtClock } from "@/lib/consult";
import { supabase, DbConsultation, DbConsultMessage } from "@/lib/supabase";

type Local = DbConsultMessage & { local?: boolean; fail?: boolean; uri?: string };

// غرفة الاستشارة بالشات: واحدة للعميل ('c') والطبيب ('d')
export function ConsultRoom({ c, role, onChanged }: { c: DbConsultation; role: "c" | "d"; onChanged: () => void }) {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<Local[]>([]);
  const [text, setText] = useState("");
  const [now, setNow] = useState(Date.now());
  const [offline, setOffline] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const listRef = useRef<FlatList>(null);
  const touched = useRef(false);
  const end = endAt(c);
  const remaining = end ? end - now : 0;
  const mine = role;

  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);

  // نهاية الوقت: نطلب من السيرفر ينهي الجلسة
  useEffect(() => {
    if (end && remaining <= 0 && !touched.current) {
      touched.current = true;
      supabase.rpc("consultation_touch", { p_id: c.id }).then(() => onChanged());
    }
    if (remaining > 0) touched.current = false;
  }, [remaining, end, c.id, onChanged]);

  useEffect(() => { if (role === "c") supabase.rpc("enter_consultation", { p_id: c.id }); }, [role, c.id]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("consultation_messages").select("*").eq("consultation_id", c.id).order("created_at");
    setMsgs((prev) => [...((data as DbConsultMessage[]) ?? []), ...prev.filter((m) => m.local && m.fail)]);
  }, [c.id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`consult_msgs_${c.id}_${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "consultation_messages", filter: `consultation_id=eq.${c.id}` }, (p) => {
        const m = p.new as DbConsultMessage;
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev.filter((x) => !(x.local && !x.fail && x.sender === m.sender && x.body === m.body)), m]));
      })
      .subscribe((status) => setOffline(status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED"));
    return () => { supabase.removeChannel(ch); };
  }, [c.id]);

  // روابط موقّعة للمرفقات
  useEffect(() => {
    msgs.forEach(async (m) => {
      if (m.file_path && !urls[m.file_path]) {
        const { data } = await supabase.storage.from("consultation-files").createSignedUrl(m.file_path, 3600);
        if (data?.signedUrl) setUrls((u) => ({ ...u, [m.file_path!]: data.signedUrl }));
      }
    });
  }, [msgs, urls]);

  const post = async (body: string | null, filePath: string | null, fileName: string | null, localId: string) => {
    const { data, error } = await supabase.rpc("send_consultation_message", { p_id: c.id, p_body: body, p_file_path: filePath, p_file_name: fileName });
    if (error || data !== "ok") {
      setMsgs((prev) => prev.map((m) => (m.id === localId ? { ...m, fail: true } : m)));
      if (data === "closed") onChanged();
      return;
    }
    setMsgs((prev) => prev.filter((m) => m.id !== localId));
    load();
  };

  const send = () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    const id = `local_${Date.now()}`;
    setMsgs((p) => [...p, { id, consultation_id: c.id, sender: mine, body, file_path: null, file_name: null, created_at: new Date().toISOString(), local: true }]);
    post(body, null, null, id);
  };

  const retry = (m: Local) => {
    setMsgs((p) => p.map((x) => (x.id === m.id ? { ...x, fail: false } : x)));
    post(m.body, m.file_path, m.file_name, m.id);
  };

  const attach = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") { Alert.alert("الأذونات", "نحتاج إذن الوصول للصور"); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (r.canceled) return;
    const uri = r.assets[0].uri;
    const ext = (uri.split(".").pop() ?? "jpg").toLowerCase().split("?")[0];
    const path = `${c.id}/${Date.now()}.${ext}`;
    try {
      const buf = await (await fetch(uri)).arrayBuffer();
      const { error } = await supabase.storage.from("consultation-files").upload(path, buf, { contentType: `image/${ext === "jpg" ? "jpeg" : ext}` });
      if (error) throw error;
      const id = `local_${Date.now()}`;
      setMsgs((p) => [...p, { id, consultation_id: c.id, sender: mine, body: null, file_path: path, file_name: "صورة", created_at: new Date().toISOString(), local: true, uri }]);
      post(null, path, "صورة", id);
    } catch { Alert.alert("", "تعذّر رفع الصورة"); }
  };

  const doExtend = (m: number) => supabase.rpc("extend_consultation", { p_id: c.id, p_min: m }).then(() => onChanged());
  const doEnd = () => Alert.alert("إنهاء الاستشارة؟", "هتنتهي الجلسة الآن.", [
    { text: "إلغاء", style: "cancel" },
    { text: "إنهاء", style: "destructive", onPress: () => supabase.rpc("end_consultation", { p_id: c.id, p_no_show: false }).then(() => onChanged()) },
  ]);
  const doNoShow = () => Alert.alert("المريض لم يحضر؟", "هتنتهي الجلسة بدون ملخص.", [
    { text: "إلغاء", style: "cancel" },
    { text: "نعم", style: "destructive", onPress: () => supabase.rpc("end_consultation", { p_id: c.id, p_no_show: true }).then(() => onChanged()) },
  ]);

  const startedMs = c.started_at ? new Date(c.started_at).getTime() : now;
  const canNoShow = role === "d" && !c.client_in_at && now - startedMs >= 10 * 60000;
  const low = remaining <= 5 * 60000;
  const waitingClient = role === "d" && !c.client_in_at;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {offline ? (
        <View style={{ backgroundColor: t.destructive, paddingVertical: 6 }}>
          <Text style={{ color: "#fff", fontFamily: TJ.bold, fontSize: 12.5, textAlign: "center" }}>انقطع الاتصال. جاري إعادة الاتصال، والعد التنازلي مستمر</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }}>
        <View style={{ backgroundColor: low ? "rgba(229,72,77,.15)" : t.goldTint, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
          <MaterialCommunityIcons name="timer-outline" size={18} color={low ? t.destructive : t.goldText} />
          <Text style={{ color: low ? t.destructive : t.goldText, fontFamily: TJ.heavy, fontSize: 17, writingDirection: "ltr" }}>{fmtClock(remaining)}</Text>
        </View>
        <Text style={{ flex: 1, color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right" }}>
          {waitingClient ? "بانتظار دخول المريض" : low ? "متبقي أقل من 5 دقائق" : "الجلسة جارية"}
        </Text>
        {role === "d" ? (
          <View style={{ flexDirection: "row-reverse", gap: 6 }}>
            {[5, 10].map((m) => (
              <Pressable key={m} onPress={() => doExtend(m)} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: t.btn }}>
                <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 12.5 }}>+{m}د</Text>
              </Pressable>
            ))}
            <Pressable onPress={doEnd} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(229,72,77,.5)" }}>
              <Text style={{ color: t.destructive, fontFamily: TJ.heavy, fontSize: 12.5 }}>إنهاء</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {c.channel !== "chat" ? <CallPanel c={c} role={role} /> : null}

      {canNoShow ? (
        <Pressable onPress={doNoShow} style={{ margin: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: "rgba(229,72,77,.5)", alignItems: "center" }}>
          <Text style={{ color: t.destructive, fontFamily: TJ.heavy, fontSize: 14 }}>إنهاء: المريض لم يحضر</Text>
        </Pressable>
      ) : null}

      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 14, gap: 8, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "center", marginTop: 40 }}>{role === "d" ? "ابدأ المحادثة مع المريض" : "اكتب للطبيب أو أرفق تحليلاً"}</Text>}
        renderItem={({ item: m }) => {
          const me = m.sender === mine;
          const url = m.uri ?? (m.file_path ? urls[m.file_path] : undefined);
          return (
            <View style={{ alignItems: me ? "flex-start" : "flex-end" }}>
              <Pressable disabled={!m.fail} onPress={() => retry(m)}
                style={{ maxWidth: "82%", backgroundColor: me ? t.gold : t.card, borderWidth: me ? 0 : 1, borderColor: t.border, borderRadius: 18, padding: 10, opacity: m.local && !m.fail ? 0.7 : 1 }}>
                {m.file_path ? (url ? <Image source={{ uri: url }} style={{ width: 200, height: 160, borderRadius: 12 }} contentFit="cover" /> : <ActivityIndicator color={t.gold} />) : null}
                {m.body ? <Text style={{ color: me ? t.onGold : t.text, fontFamily: TJ.medium, fontSize: 15, lineHeight: 23, textAlign: "right" }}>{m.body}</Text> : null}
                <Text style={{ color: me ? t.onGoldSub : t.muted, fontFamily: TJ.medium, fontSize: 10.5, marginTop: 3 }}>
                  {m.fail ? "تعذر الإرسال · اضغط لإعادة المحاولة" : new Date(m.created_at).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })}
                </Text>
              </Pressable>
            </View>
          );
        }}
      />

      <View style={{ flexDirection: "row-reverse", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: insets.bottom + 10, borderTopWidth: 1, borderTopColor: t.border, backgroundColor: t.bg }}>
        <Pressable onPress={attach} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="paperclip" size={22} color={t.text} />
        </Pressable>
        <TextInput value={text} onChangeText={setText} multiline textAlign="right" placeholder="اكتب رسالة…" placeholderTextColor={t.muted}
          style={{ flex: 1, maxHeight: 110, backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.border, paddingHorizontal: 16, paddingVertical: 10, color: t.text, fontFamily: TJ.medium, fontSize: 15 }} />
        <Pressable onPress={send} disabled={!text.trim()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? t.gold : t.btn, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="send" size={20} color={text.trim() ? t.onGold : t.muted} style={{ transform: [{ scaleX: -1 }] }} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
