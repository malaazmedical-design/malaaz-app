import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { getExpoPushToken } from "@/lib/push";
import { supabase } from "@/lib/supabase";

// Admin push notifications (supabase/test-project/36_admin_push.sql): the admin signs in to the client app with the admin
// account; the phone then gets a push for every new booking / consultation / question / admin alert.
// The database decides who is an admin (is_admin), so a normal user can never register a token.
const OFF_KEY = "malaz.adminpush.off.v1"; // the admin switched it off on this phone

export async function isAdminAccount(): Promise<boolean> {
  try {
    const { data } = await supabase.rpc("is_admin");
    return data === true;
  } catch {
    return false;
  }
}

export async function adminPushWantedHere(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(OFF_KEY)) !== "1"; } catch { return true; }
}

export async function registerAdminPush(): Promise<boolean> {
  try {
    const token = await getExpoPushToken();
    if (!token) return false;
    const { data } = await supabase.rpc("register_admin_push_token", { p_token: token, p_platform: Platform.OS });
    if (data !== "ok") return false;
    await AsyncStorage.removeItem(OFF_KEY);
    return true;
  } catch {
    return false;
  }
}

// markOff = true when the admin turns it off on purpose (stays off after the next sign-in); false on sign-out
export async function unregisterAdminPush(markOff: boolean): Promise<void> {
  try {
    const token = await getExpoPushToken();
    if (token) await supabase.rpc("unregister_admin_push_token", { p_token: token });
    if (markOff) await AsyncStorage.setItem(OFF_KEY, "1");
  } catch {}
}
