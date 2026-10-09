// العميل بيشوف حالتين بس: تم الإرسال ← تم الرد (حالات الأدمن الداخلية مخفية)
export function askStatus(status: string): { label: string; color: string; icon: "send-check-outline" | "check-circle-outline" | "close-circle-outline" } {
  if (status === "answered") return { label: "تم الرد", color: "#1fa65a", icon: "check-circle-outline" };
  if (status === "cancelled") return { label: "ملغي", color: "#e5484d", icon: "close-circle-outline" };
  return { label: "تم الإرسال", color: "#c9a84c", icon: "send-check-outline" };
}
