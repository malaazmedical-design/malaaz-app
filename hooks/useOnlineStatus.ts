import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

import { emitReconnect } from "@/lib/reconnect";

const PING_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://omsictbrqlsohrmxeuym.supabase.co") + "/";

// shared by every hook instance so a reconnect is announced only once
let wasOnline = true;
const markOnline = (v: boolean) => { const back = v && !wasOnline; wasOnline = v; if (back) emitReconnect(); };

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      setOnline(navigator.onLine);
      const setTrue = () => { setOnline(true); markOnline(true); };
      const setFalse = () => { setOnline(false); markOnline(false); };
      window.addEventListener("online", setTrue);
      window.addEventListener("offline", setFalse);
      return () => {
        window.removeEventListener("online", setTrue);
        window.removeEventListener("offline", setFalse);
      };
    }

    // Native: ping Supabase عشان نتحقق من الاتصال
    const ping = async () => {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 4000);
        await fetch(PING_URL, { method: "HEAD", signal: controller.signal });
        clearTimeout(t);
        setOnline(true);
        markOnline(true);
      } catch {
        setOnline(false);
        markOnline(false);
      }
    };

    ping();
    // فحص دوري كل 30 ثانية لاكتشاف انقطاع الإنترنت أثناء نشاط التطبيق
    // while offline check every 5s so a reconnect is noticed quickly, otherwise every 30s
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => { await ping(); timer = setTimeout(loop, wasOnline ? 30_000 : 5_000); };
    timer = setTimeout(loop, 5_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") ping();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return online;
}
