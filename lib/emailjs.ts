import { supabase } from "@/lib/supabase";

export type MalaazEmailParams = {
  to_email: string;
  subject: string;
  title: string;
  title_color: string;
  message: string;
  details: string;
  button_text: string;
  button_link: string;
  button_color: string;
};

// إرسال إيميل عبر Edge Function (send-email) اللي بيكلّم EmailJS من السيرفر
// — كده الـ Private Key بتاع EmailJS يفضل على السيرفر بس، ومش موجود في كود التطبيق
// fire and forget، الفشل لا يكسر العملية؛ نتيجة كل محاولة بتُسجّل في email_send_logs على السيرفر
export async function sendMalaazEmail(params: MalaazEmailParams): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("send-email", { body: params });
    if (error) console.warn("send-email invoke error:", error);
  } catch (e) {
    console.warn("send-email invoke error:", e);
  }
}
