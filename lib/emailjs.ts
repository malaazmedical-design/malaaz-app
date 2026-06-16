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
export async function sendMalaazEmail(params: MalaazEmailParams): Promise<void> {
  try {
    await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE,
        template_id: EMAILJS_TEMPLATE,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: params,
      }),
    });
  } catch (e) {
    console.warn("EmailJS error:", e);
  }
}
