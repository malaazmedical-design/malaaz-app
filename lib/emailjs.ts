import { supabase } from "@/lib/supabase";

// نفس إعدادات EmailJS المستخدمة في موقع ملاذ (provider.html)
const EMAILJS_SERVICE = "service_tv0w6ov";
const EMAILJS_TEMPLATE = "template_3arzsvv";
const EMAILJS_PUBLIC_KEY = "P2Xy0_OBIWdVXk1gE";

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

// إرسال إيميل عبر EmailJS REST API — fire and forget، الفشل لا يكسر العملية
// لكن بنسجّل نتيجة كل محاولة (نجاح/فشل + رد EmailJS) في جدول تشخيصي
// عشان نقدر نعرف سبب الفشل لو حصل، بدل ما يفضل صامت تماماً
export async function sendMalaazEmail(params: MalaazEmailParams): Promise<void> {
  let ok = false;
  let statusCode: number | null = null;
  let responseBody = "";
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE,
        template_id: EMAILJS_TEMPLATE,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: params,
      }),
    });
    ok = res.ok;
    statusCode = res.status;
    responseBody = await res.text();
    if (!ok) console.warn("EmailJS send failed:", statusCode, responseBody);
  } catch (e) {
    responseBody = e instanceof Error ? e.message : String(e);
    console.warn("EmailJS error:", e);
  }
  supabase.from("email_send_logs").insert({
    to_email: params.to_email,
    subject: params.subject,
    ok,
    status_code: statusCode,
    response_body: responseBody.slice(0, 2000),
  }).then(() => {}, () => {});
}
