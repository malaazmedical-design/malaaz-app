import { Linking } from "react-native";

// كل التواصل في التطبيق بيروح لرقم الشركة الرئيسي — مش لرقم مقدم الخدمة
export const COMPANY_PHONE = "01039091989";
const COMPANY_PHONE_INTL = "201039091989";

export function callCompany(): void {
  Linking.openURL(`tel:${COMPANY_PHONE}`).catch(() => {});
}

// رسالة واتساب جاهزة حسب مكان الضغط (سياق الاستفسار)
export function whatsappCompany(message: string): void {
  Linking.openURL(
    `https://wa.me/${COMPANY_PHONE_INTL}?text=${encodeURIComponent(message)}`
  ).catch(() => {});
}
