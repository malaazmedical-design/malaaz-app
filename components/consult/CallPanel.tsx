import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { Text } from "@/components/i18n";

import { TJ, useMalaz } from "@/constants/malazTheme";
import { getLiveKit } from "@/lib/livekit";
import { supabase, DbConsultation } from "@/lib/supabase";

type Phase = "check" | "joining" | "in" | "fallback";
type Conn = { url: string; token: string };

// Voice / video part of a live consultation. The chat room below it stays open all the time (also as the fallback).
export function CallPanel({ c, role }: { c: DbConsultation; role: "c" | "d" }) {
  const t = useMalaz();
  const lk = getLiveKit();
  const isVideo = c.channel === "video";
  const [phase, setPhase] = useState<Phase>("check");
  const [fallbackMsg, setFallbackMsg] = useState("");
  const [conn, setConn] = useState<Conn | null>(null);
  const [mic, setMic] = useState<"idle" | "ok" | "fail" | "testing">("idle");
  const [cam, setCam] = useState<"idle" | "ok" | "fail" | "testing">("idle");
  const [busy, setBusy] = useState(false);
  const other = role === "d" ? "المريض" : "الطبيب";

  if (!lk) {
    return (
      <View style={{ margin: 12, padding: 14, borderRadius: 16, backgroundColor: t.card, borderWidth: 1, borderColor: t.border }}>
        <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 14.5, textAlign: "right" }}>
          {isVideo ? "مكالمة الفيديو" : "المكالمة الصوتية"} تحتاج تحديث التطبيق
        </Text>
        <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13, textAlign: "right", marginTop: 4, lineHeight: 20 }}>
          حدّث التطبيق لآخر نسخة. في الوقت الحالي كمّل الاستشارة بالشات تحت.
        </Text>
      </View>
    );
  }

  const testDevices = async () => {
    setMic("testing");
    setCam(isVideo ? "testing" : "idle");
    try {
      const stream: any = await lk.webrtc.mediaDevices.getUserMedia({ audio: true, video: isVideo });
      setMic(stream.getAudioTracks().length ? "ok" : "fail");
      if (isVideo) setCam(stream.getVideoTracks().length ? "ok" : "fail");
      stream.getTracks().forEach((tr: any) => tr.stop());
    } catch {
      setMic("fail");
      if (isVideo) setCam("fail");
    }
  };

  const join = async () => {
    setBusy(true);
    setPhase("joining");
    const { data, error } = await supabase.functions.invoke("livekit-token", { body: { consultation_id: c.id } });
    setBusy(false);
    if (error || !data?.token) {
      const code = (data as any)?.error ?? "";
      setFallbackMsg(
        code === "rtc_unavailable"
          ? "الصوت والفيديو متوقفان مؤقتًا. كمّل الاستشارة بالشات."
          : "تعذّر بدء المكالمة. تأكد من الإنترنت أو كمّل بالشات.",
      );
      setPhase("fallback");
      return;
    }
    setConn({ url: data.url, token: data.token });
    setPhase("in");
  };

  const statusIcon = (s: typeof mic) =>
    s === "ok" ? <MaterialCommunityIcons name="check-circle" size={18} color={t.online} />
    : s === "fail" ? <MaterialCommunityIcons name="close-circle" size={18} color={t.destructive} />
    : s === "testing" ? <ActivityIndicator size="small" color={t.gold} />
    : <MaterialCommunityIcons name="circle-outline" size={18} color={t.muted} />;

  if (phase === "check" || phase === "joining") {
    const passed = mic === "ok" && (!isVideo || cam === "ok");
    return (
      <View style={{ margin: 12, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, gap: 10 }}>
        <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15.5, textAlign: "right" }}>فحص الجهاز قبل الدخول</Text>
        <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right" }}>
          تأكد أن الميكروفون{isVideo ? " والكاميرا" : ""} يعمل قبل بدء الاستشارة
        </Text>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
          {statusIcon(mic)}
          <Text style={{ color: t.text2, fontFamily: TJ.bold, fontSize: 14 }}>الميكروفون {mic === "ok" ? "يعمل" : mic === "fail" ? "لا يعمل — اسمح بالصلاحية" : ""}</Text>
        </View>
        {isVideo ? (
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
            {statusIcon(cam)}
            <Text style={{ color: t.text2, fontFamily: TJ.bold, fontSize: 14 }}>الكاميرا {cam === "ok" ? "تعمل" : cam === "fail" ? "لا تعمل — اسمح بالصلاحية" : ""}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 4 }}>
          <Pressable onPress={testDevices} disabled={busy} style={{ flex: 1, height: 46, borderRadius: 14, borderWidth: 1.5, borderColor: t.border, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 14 }}>اختبار الجهاز</Text>
          </Pressable>
          <Pressable onPress={join} disabled={!passed || busy} style={{ flex: 1.4, height: 46, borderRadius: 14, backgroundColor: passed ? t.gold : t.btn, alignItems: "center", justifyContent: "center" }}>
            {busy ? <ActivityIndicator color={t.onGold} /> : <Text style={{ color: passed ? t.onGold : t.muted, fontFamily: TJ.heavy, fontSize: 14 }}>جاهز · ادخل الجلسة</Text>}
          </Pressable>
        </View>
      </View>
    );
  }

  if (phase === "fallback" || !conn) {
    return (
      <View style={{ margin: 12, padding: 14, borderRadius: 16, backgroundColor: t.card, borderWidth: 1, borderColor: t.border }}>
        <Text style={{ color: t.text, fontFamily: TJ.bold, fontSize: 14, textAlign: "right", lineHeight: 22 }}>{fallbackMsg}</Text>
        <Pressable onPress={() => setPhase("check")} style={{ marginTop: 10, alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: t.btn }}>
          <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 13.5 }}>إعادة المحاولة</Text>
        </Pressable>
      </View>
    );
  }

  const { LiveKitRoom, AudioSession } = lk.rn;
  return (
    <CallRoom
      key={conn.token}
      lk={lk}
      conn={conn}
      isVideo={isVideo}
      otherName={other}
      onFail={(msg: string) => { setFallbackMsg(msg); setPhase("fallback"); }}
      LiveKitRoom={LiveKitRoom}
      AudioSession={AudioSession}
    />
  );
}

function CallRoom({ lk, conn, isVideo, otherName, onFail, LiveKitRoom, AudioSession }: any) {
  const t = useMalaz();
  useEffect(() => {
    AudioSession.startAudioSession();
    return () => { AudioSession.stopAudioSession(); };
  }, [AudioSession]);

  return (
    <LiveKitRoom
      serverUrl={conn.url}
      token={conn.token}
      connect
      audio
      video={isVideo}
      options={{ adaptiveStream: { pixelDensity: "screen" }, dynacast: true }}
      onError={() => onFail("انقطعت المكالمة. كمّل بالشات أو أعد المحاولة.")}
    >
      <RoomBody lk={lk} isVideo={isVideo} otherName={otherName} />
    </LiveKitRoom>
  );
}

function RoomBody({ lk, isVideo, otherName }: { lk: NonNullable<ReturnType<typeof getLiveKit>>; isVideo: boolean; otherName: string }) {
  const t = useMalaz();
  const { useConnectionState, useRemoteParticipants, useLocalParticipant, useTracks, VideoTrack, isTrackReference } = lk.rn as any;
  const { ConnectionState, Track } = lk.client as any;
  const state = useConnectionState();
  const remotes = useRemoteParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera]);
  const hadRemote = useRef(false);
  if (remotes.length) hadRemote.current = true;

  const remoteTrack = tracks.find((x: any) => !x.participant.isLocal && isTrackReference(x));
  const localTrack = tracks.find((x: any) => x.participant.isLocal && isTrackReference(x));
  const dropped = state === ConnectionState.Reconnecting || state === ConnectionState.Disconnected;
  const connecting = state === ConnectionState.Connecting;

  const banner = dropped ? { text: "انقطع اتصالك. جاري إعادة الاتصال، والعد التنازلي مستمر", bad: true }
    : !remotes.length ? { text: hadRemote.current ? `انقطع اتصال ${otherName}. سيعود قريبًا` : `بانتظار دخول ${otherName}`, bad: hadRemote.current }
    : null;

  return (
    <View style={{ margin: 12, borderRadius: 18, overflow: "hidden", backgroundColor: "#0b1514", height: isVideo ? 280 : 150 }}>
      {isVideo && remoteTrack ? (
        <VideoTrack trackRef={remoteTrack} style={{ flex: 1 }} objectFit="cover" />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
          {connecting ? <ActivityIndicator color={t.gold} /> : (
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#243433", alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name={remotes.length ? "account-voice" : "account-clock-outline"} size={32} color="#c9a84c" />
            </View>
          )}
          <Text style={{ color: "#f2efe6", fontFamily: TJ.bold, fontSize: 14 }}>{remotes.length ? `${otherName} متصل` : connecting ? "جاري الاتصال…" : ""}</Text>
        </View>
      )}

      {isVideo && localTrack && isCameraEnabled ? (
        <View style={{ position: "absolute", top: 10, left: 10, width: 84, height: 112, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: "#c9a84c" }}>
          <VideoTrack trackRef={localTrack} style={{ flex: 1 }} objectFit="cover" mirror />
        </View>
      ) : null}

      {banner ? (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, backgroundColor: banner.bad ? t.destructive : "rgba(0,0,0,.55)", paddingVertical: 5 }}>
          <Text style={{ color: "#fff", fontFamily: TJ.bold, fontSize: 12, textAlign: "center" }}>{banner.text}</Text>
        </View>
      ) : null}

      <View style={{ position: "absolute", bottom: 10, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 14 }}>
        <Pressable onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch(() => Alert.alert("", "تعذّر تشغيل الميكروفون"))}
          style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: isMicrophoneEnabled ? "rgba(255,255,255,.18)" : t.destructive, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={isMicrophoneEnabled ? "microphone" : "microphone-off"} size={22} color="#fff" />
        </Pressable>
        {isVideo ? (
          <Pressable onPress={() => localParticipant.setCameraEnabled(!isCameraEnabled).catch(() => Alert.alert("", "تعذّر تشغيل الكاميرا"))}
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: isCameraEnabled ? "rgba(255,255,255,.18)" : t.destructive, alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name={isCameraEnabled ? "video" : "video-off"} size={22} color="#fff" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
