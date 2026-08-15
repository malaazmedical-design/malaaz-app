import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

const PING_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://omsictbrqlsohrmxeuym.supabase.co") + "/";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      setOnline(navigator.onLine);
      const setTrue = () => setOnline(true);
      const setFalse = () => setOnline(false);
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
      } catch {
        setOnline(false);
      }
    };

    ping();
    // فحص دوري كل 30 ثانية لاكتشاف انقطاع الإنترنت أثناء نشاط التطبيق
    const interval = setInterval(ping, 30_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") ping();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  return online;
}
