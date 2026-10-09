import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TJ, useMalaz } from "@/constants/malazTheme";
import { COMPANY_PHONE } from "@/lib/contact";

type Section = { h: string; p: string };

const TERMS: Section[] = [
  { h: "١. عن التطبيق", p: "ملاذ منصة تربط العملاء بمقدمي خدمات رعاية صحية منزلية (أطباء، تمريض، أشعة) واستشارات طبية. التطبيق وسيط للحجز والتواصل، والخدمة الطبية نفسها يقدمها مقدم الخدمة المرخّص." },
  { h: "٢. استخدام التطبيق", p: "بتستخدم التطبيق بمعلومات صحيحة عنك وعن المريض. مسؤول عن دقة الاسم والعنوان ورقم الموبايل، وعن أي حجز بتعمله باسمك." },
  { h: "٣. الحجز والإلغاء", p: "الحجز يعتبر مؤكد لما مقدم الخدمة يقبله. تقدر تلغي الحجز قبل خروج مقدم الخدمة. تكرار الحجز ثم الإلغاء أو عدم التواجد ممكن يؤدي لإيقاف الحساب." },
  { h: "٤. الأسعار والدفع", p: "السعر بيظهر قبل تأكيد الحجز، وبيتحدد حسب مقدم الخدمة والخدمة المختارة. الدفع بيتم بالطريقة المختارة وقت الحجز (كاش أو محفظة إلكترونية)." },
  { h: "٥. الاستشارات الطبية", p: "الاستشارة عن بُعد للتوجيه والمتابعة ولا تغني عن الفحص الإكلينيكي. في الحالات الطارئة اتصل بالإسعاف (123) فوراً ولا تنتظر رد التطبيق." },
  { h: "٦. مسؤولية مقدم الخدمة", p: "مقدم الخدمة مسؤول عن التشخيص والعلاج الذي يقدمه. ملاذ بتراجع بيانات مقدمي الخدمة قبل التفعيل، لكنها لا تتحمل نتائج القرارات الطبية." },
  { h: "٧. التقييمات", p: "تقييمك بيتراجع من الإدارة قبل ظهوره. نحتفظ بحق حذف أي تقييم يحتوي إساءة أو معلومات غير صحيحة." },
  { h: "٨. تعديل الشروط", p: "ممكن نحدّث الشروط من وقت للتاني، وهنبلغك داخل التطبيق لو التعديل جوهري. استمرارك في الاستخدام معناه الموافقة." },
];

const PRIVACY: Section[] = [
  { h: "١. البيانات اللي بنجمعها", p: "الاسم، رقم الموبايل، البريد الإلكتروني، العناوين، بيانات الحجز، وللعملاء الاختيارية: تاريخ الميلاد والنوع وأفراد العائلة. ولمقدمي الخدمة: بيانات مهنية ومناطق التغطية." },
  { h: "٢. إزاي بنستخدمها", p: "لتنفيذ الحجز وربطك بمقدم الخدمة، وإرسال إشعارات الحجز، وتحسين الخدمة. لا نبيع بياناتك لأي جهة." },
  { h: "٣. الموقع", p: "بنستخدم موقعك لإيجاد أقرب مقدم خدمة وتوجيهه لعنوانك فقط، ولا نتتبعك في الخلفية." },
  { h: "٤. مشاركة البيانات", p: "رقمك وعنوانك بيظهروا لمقدم الخدمة المؤكد لحجزك فقط أثناء الحجز، وبيتخفوا عنه بعد انتهاء الحجز أو إلغائه." },
  { h: "٥. الأمان", p: "بياناتك محفوظة على خوادم مؤمّنة بصلاحيات وصول مقيدة، والاتصال مشفّر." },
  { h: "٦. حقوقك", p: "تقدر تعدّل بياناتك من الملف الشخصي، أو تطلب حذف حسابك وبياناتك بالتواصل معانا." },
  { h: "٧. التواصل", p: `لأي استفسار عن الخصوصية تواصل معانا على واتساب: ${COMPANY_PHONE}` },
];

export default function LegalScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const isPrivacy = kind === "privacy";
  const sections = isPrivacy ? PRIVACY : TERMS;
  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top + 12 + webTop, paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="رجوع" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="arrow-right" size={22} color={t.text} />
        </Pressable>
        <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 22 }}>{isPrivacy ? "سياسة الخصوصية" : "الشروط والأحكام"}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 12 }} showsVerticalScrollIndicator={false}>
        {sections.map((s) => (
          <View key={s.h} style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 18, padding: 16 }}>
            <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 15, textAlign: "right" }}>{s.h}</Text>
            <Text style={{ color: t.text2, fontFamily: TJ.medium, fontSize: 14, lineHeight: 24, textAlign: "right", marginTop: 6 }}>{s.p}</Text>
          </View>
        ))}
        <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12, textAlign: "center", marginTop: 6 }}>آخر تحديث: أكتوبر 2026</Text>
      </ScrollView>
    </View>
  );
}
