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

async function runDelete(onDeleted: () => void | Promise<void>) {
  try {
    const { data, error } = await supabase.rpc("delete_my_account");
    if (error) throw new Error(error.message);
    if (data === "active_items") {
      Alert.alert("مش هينفع نحذف الحساب دلوقتي", "عندك حجوزات أو استشارات لسه شغالة. خلّصها أو الغيها الأول وبعدين احذف الحساب.");
      return;
    }
    if (data === "admin") {
      Alert.alert("تنبيه", "حسابات الإدارة بتتحذف من لوحة الإدارة.");
      return;
    }
    if (data !== "ok") throw new Error(String(data ?? "تعذر الحذف"));
    try { await supabase.auth.signOut({ scope: "local" }); } catch {}
    await onDeleted();
    Alert.alert("تم حذف الحساب", "تم حذف حسابك وبياناتك الشخصية.");
  } catch (e: any) {
    Alert.alert("تعذر حذف الحساب", e?.message ?? "حاول مرة أخرى، ولو استمرت المشكلة تواصل مع الدعم.");
  }
}
