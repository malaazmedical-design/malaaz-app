import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TJ, useMalaz } from "@/constants/malazTheme";

type Item = [string, string];
type Section = { id: string; title: string; items: Item[] };

// Texts follow the final design handoff. They are drafts: legal review is needed before launch and no refund periods are set yet.
const CLIENT: Section[] = [
  {
    id: "terms", title: "الشروط والأحكام",
    items: [
      ["طبيعة المنصة", "ملاذ منصة تربط المستخدم بمقدمي خدمات صحية مستقلين من أطباء وتمريض ومراكز أشعة، ولا تقدم الخدمة الطبية بنفسها."],
      ["الاستشارة الأونلاين", "الاستشارة الأونلاين للمتابعة فقط وليست بديلًا عن الكشف الطبي، ولا تُستخدم في الحالات الطارئة. في الطوارئ توجه لأقرب مستشفى."],
      ["مسؤولية المستخدم", "المستخدم مسؤول عن صحة البيانات والعنوان ورقم التواصل، وعن الالتزام بموعد الخدمة."],
      ["الدفع", "يتم تأكيد الدفع عن طريق فريق ملاذ بعد التواصل مع المستخدم. تبدأ الخدمة بعد تأكيد الدفع."],
      ["تعديل الشروط", "يجوز لملاذ تحديث هذه الشروط، ويُعلن المستخدم بأي تغيير جوهري."],
    ],
  },
  {
    id: "privacy", title: "سياسة الخصوصية",
    items: [
      ["البيانات التي نجمعها", "الاسم ورقم الموبايل والبريد والعنوان وأفراد العائلة والملاحظات الطبية والمرفقات التي يرسلها المستخدم."],
      ["كيف نستخدمها", "لتنفيذ الحجز والتواصل وتحسين الخدمة، ولا تُباع لأي طرف ثالث."],
      ["المشاركة", "تُشارَك البيانات اللازمة فقط مع مقدم الخدمة المعني بالحجز، ويُخفى جزء من بيانات التواصل حتى تأكيد الحجز."],
      ["المرفقات الطبية", "تظهر لمقدم الخدمة الذي أرسل لها المستخدم، وللإدارة عند المراجعة."],
      ["حقوقك", "يمكنك طلب تعديل بياناتك أو حذف حسابك عن طريق الدعم."],
    ],
  },
  {
    id: "refund", title: "سياسة الإلغاء والاسترداد",
    items: [
      ["قبل تأكيد الدفع", "يمكن إلغاء الحجز بدون أي رسوم قبل تأكيد الدفع."],
      ["بعد تأكيد الدفع", "عند إلغاء المستخدم، تراجع الإدارة الطلب وتحدد قيمة الاسترداد حسب حالة الخدمة."],
      ["إلغاء مقدم الخدمة أو عدم حضوره", "يُسترد المبلغ كاملًا، أو يُعاد الحجز مع مقدم آخر بناءً على اختيار المستخدم."],
      ["طريقة الاسترداد", "يتم الاسترداد عن طريق فريق ملاذ بنفس وسيلة الدفع المستخدمة."],
    ],
  },
];

const PROVIDER: Section[] = [
  {
    id: "terms", title: "شروط مقدم الخدمة",
    items: [
      ["الترخيص والبيانات", "يلتزم مقدم الخدمة بصحة بياناته وتراخيصه، وتراجع الإدارة الحساب قبل التفعيل."],
      ["الاستشارة الأونلاين", "الاستشارة للمتابعة فقط وليست بديلًا عن الكشف، ولا تُستخدم للحالات الطارئة، ويوجَّه المريض للطوارئ عند الحاجة."],
      ["الالتزام بالمواعيد", "يلتزم المقدم بمواعيد الحجز، وتُحتسب الإلغاءات المتكررة أو عدم الحضور ضمن تقييم الأداء."],
      ["الأسعار والدفع", "يحدد المقدم سعره ضمن النطاق الذي تضعه الإدارة، وتتولى الإدارة تأكيد الدفع مع المريض."],
    ],
  },
  {
    id: "privacy", title: "سرية بيانات المرضى",
    items: [
      ["استخدام البيانات", "بيانات المريض وملاحظاته ومرفقاته تُستخدم فقط لتقديم الخدمة المحجوزة."],
      ["منع المشاركة", "يُمنع حفظ بيانات المرضى خارج المنصة أو مشاركتها مع أي طرف آخر."],
      ["بيانات التواصل", "يظهر رقم المريض وموقعه بعد تأكيد الحجز وحتى اكتماله فقط."],
    ],
  },
  {
    id: "refund", title: "سياسة الإلغاء",
    items: [
      ["إلغاء المقدم", "عند الإلغاء يُطلب سبب يصل للإدارة، ويُعاد الحجز لمقدم آخر أو يُسترد المبلغ للمريض."],
      ["عدم الحضور", "عدم الحضور في موعد الخدمة يُحتسب مخالفة وقد يؤثر على ظهور الحساب."],
    ],
  },
];

export default function LegalScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { role, open: openParam } = useLocalSearchParams<{ role?: string; open?: string }>();
  const sections = role === "provider" ? PROVIDER : CLIENT;
  const [open, setOpen] = useState<string | null>(openParam && sections.some((s) => s.id === openParam) ? openParam : sections[0].id);
  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top + 12 + webTop, paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="رجوع" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="arrow-right" size={22} color={t.text} />
        </Pressable>
        <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 22 }}>الشروط والسياسات</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 12 }} showsVerticalScrollIndicator={false}>
        {sections.map((sec) => {
          const isOpen = open === sec.id;
          return (
            <View key={sec.id} style={{ backgroundColor: t.card, borderWidth: 1, borderColor: isOpen ? t.gold : t.border, borderRadius: 20, overflow: "hidden" }}>
              <Pressable onPress={() => setOpen(isOpen ? null : sec.id)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}
                style={{ minHeight: 58, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 }}>
                <Text style={{ color: isOpen ? t.goldText : t.text, fontFamily: TJ.heavy, fontSize: 16 }}>{sec.title}</Text>
                <MaterialCommunityIcons name={isOpen ? "chevron-up" : "chevron-down"} size={22} color={t.muted} />
              </Pressable>
              {isOpen ? (
                <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 12 }}>
                  {sec.items.map(([h, p]) => (
                    <View key={h}>
                      <Text style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 14, textAlign: "right" }}>{h}</Text>
                      <Text style={{ color: t.text2, fontFamily: TJ.medium, fontSize: 14, lineHeight: 24, textAlign: "right", marginTop: 3 }}>{p}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
