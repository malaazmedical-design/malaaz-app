import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Alert } from "react-native";
import { supabase } from "./supabase";

// حذف الحساب من التطبيق (مطلوب من أبل وجوجل بلاي). الحذف بيتم كله في السيرفر (delete_my_account، ملف SQL 33).
// confirmDeleteAccount بيسأل مرتين، وبعدين بينفّذ، وبينادي onDeleted بعد ما الحساب يتحذف عشان الشاشة تخرج المستخدم.
export function confirmDeleteAccount(kind: "client" | "provider", onDeleted: () => void | Promise<void>) {
  const what = kind === "provider"
    ? "هيتم إيقاف ملفك وحذف بياناتك (الاسم، الموبايل، الإيميل، الصورة، النبذة) وإنهاء حسابك نهائيًا."
    : "هيتم حذف بياناتك (الاسم، الموبايل، العناوين، أفراد العائلة، الملفات الطبية، تذكير الأدوية) وإنهاء حسابك نهائيًا.";
  Alert.alert(
    "حذف الحساب؟",
    `${what}\n\nمش هينفع نرجّع الحساب بعد كده. سجلات الحجز والدفع بتفضل محفوظة من غير أي بيانات تعرّف بيك.`,
    [
      { text: "إلغاء", style: "cancel" },
      {
        text: "متابعة", style: "destructive",
        onPress: () => Alert.alert("تأكيد الحذف النهائي", "هل أنت متأكد إنك عايز تحذف حسابك؟", [
          { text: "لا، إلغاء", style: "cancel" },
          { text: "حذف حسابي نهائيًا", style: "destructive", onPress: () => runDelete(onDeleted) },
        ]),
      },
    ],
  );
}

function report(code: unknown) {
  if (code === "active_items") {
    Alert.alert("مش هينفع نحذف الحساب دلوقتي", "عندك حجوزات أو استشارات لسه شغالة. خلّصها أو الغيها الأول وبعدين احذف الحساب.");
  } else if (code === "admin") {
    Alert.alert("تنبيه", "حسابات الإدارة بتتحذف من لوحة الإدارة.");
  } else {
    throw new Error(String(code ?? "تعذر الحذف"));
  }
}

// ما بيتخزن على الموبايل نفسه (الحجوزات المحفوظة، الأدوية وتنبيهاتها) لازم يتمسح مع الحساب، وإلا حساب جديد على نفس الموبايل هيشوفها
async function wipeLocalData() {
  await AsyncStorage.multiRemove(["malaaz.profile.v1", "malaaz.bookings.v1", "malaaz.medicines.v1", "malaz.provider.notesSent.v1"]).catch(() => {});
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

async function runDelete(onDeleted: () => void | Promise<void>) {
  try {
    // 1) can it proceed? (nothing is deleted before we know)
    const pre = await supabase.rpc("delete_account_precheck");
    if (pre.error) throw new Error(pre.error.message);
    if (pre.data !== "ok") return report(pre.data);
    // 2) stored files go through the Storage API (SQL is not allowed to delete them)
    const files = await supabase.rpc("my_storage_files");
    if (files.error) throw new Error(files.error.message);
    const byBucket: Record<string, string[]> = {};
    for (const f of (files.data ?? []) as { bucket: string; path: string }[]) (byBucket[f.bucket] ??= []).push(f.path);
    for (const [bucket, paths] of Object.entries(byBucket)) {
      for (let i = 0; i < paths.length; i += 100) {
        const { error: rmErr } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
        if (rmErr) throw new Error(rmErr.message);
      }
    }
    // 3) the account itself
    const { data, error } = await supabase.rpc("delete_my_account");
    if (error) throw new Error(error.message);
    if (data !== "ok") return report(data);
    try { await supabase.auth.signOut({ scope: "local" }); } catch {}
    await wipeLocalData();
    await onDeleted();
    Alert.alert("تم حذف الحساب", "تم حذف حسابك وبياناتك الشخصية.");
  } catch (e: any) {
    Alert.alert("تعذر حذف الحساب", e?.message ?? "حاول مرة أخرى، ولو استمرت المشكلة تواصل مع الدعم.");
  }
}
