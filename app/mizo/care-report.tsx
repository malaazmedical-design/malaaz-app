import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, SafeAreaView,
  Pressable, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";

type Severity = "low" | "medium" | "high";

const SEVERITY_OPTIONS: { key: Severity; label: string; color: string; icon: string }[] = [
  { key: "low",    label: "عادي",     color: "#1C6B3A", icon: "circle-small" },
  { key: "medium", label: "متوسط",    color: "#C9A84C", icon: "circle-medium" },
  { key: "high",   label: "خطير",     color: "#CC2200", icon: "alert-circle"  },
];

type Report = {
  id: string;
  note: string;
  severity: Severity;
  created_at: string;
};

export default function CareReportScreen() {
  const [note, setNote] = useState("");
  const [severity, setSeverity] = useState<Severity>("low");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadReports = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("care_reports")
        .select("id,note,severity,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (data) setReports(data as Report[]);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadReports(); }, []);

  const handleSubmit = async () => {
    if (!note.trim()) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert("تنبيه", "لازم تسجل دخول كممرض عشان تكتب تقرير");
        return;
      }
      const { error } = await supabase.from("care_reports").insert({
        nurse_user_id: session.user.id,
        note: note.trim(),
        severity,
      });
      if (error) throw error;
      setNote("");
      setSeverity("low");
      await loadReports();
    } catch {
      Alert.alert("خطأ", "مش قدر يحفظ التقرير دلوقتي");
    }
    setSubmitting(false);
  };

  const sevColor = (s: Severity) => SEVERITY_OPTIONS.find((x) => x.key === s)?.color ?? "#1C2B2A";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-right" size={26} color="#C9A84C" />
        </Pressable>
        <Text style={styles.headerTitle}>تقارير الممرض السرية</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* كتابة تقرير جديد */}
        <View style={styles.card}>
          <Text style={styles.label}>تقرير جديد</Text>
          <TextInput
            style={styles.textarea}
            value={note}
            onChangeText={setNote}
            placeholder="اكتب ملاحظتك هنا..."
            placeholderTextColor="#9AABAA"
            multiline
            numberOfLines={4}
            textAlign="right"
            textAlignVertical="top"
          />
          <Text style={[styles.label, { marginTop: 12 }]}>درجة الخطورة</Text>
          <View style={styles.severityRow}>
            {SEVERITY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={[styles.sevBtn, severity === opt.key && { backgroundColor: opt.color }]}
                onPress={() => setSeverity(opt.key)}
              >
                <Text style={[styles.sevText, severity === opt.key && { color: "#fff" }]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>حفظ التقرير</Text>
            )}
          </Pressable>
        </View>

        {/* التقارير السابقة */}
        <Text style={styles.sectionTitle}>التقارير السابقة</Text>
        {loading ? (
          <ActivityIndicator color="#1C2B2A" style={{ marginTop: 20 }} />
        ) : reports.length === 0 ? (
          <Text style={styles.empty}>لا توجد تقارير بعد</Text>
        ) : (
          reports.map((r) => (
            <View key={r.id} style={[styles.reportRow, { borderLeftColor: sevColor(r.severity) }]}>
              <View style={[styles.sevDot, { backgroundColor: sevColor(r.severity) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.reportNote}>{r.note}</Text>
                <Text style={styles.reportDate}>
                  {new Date(r.created_at).toLocaleString("ar-EG")}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7F6" },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1C2B2A",
  },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 17, color: "#C9A84C" },
  backBtn: { padding: 4 },
  body: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  label: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#1C2B2A", textAlign: "right", marginBottom: 8 },
  textarea: {
    backgroundColor: "#F5F7F6",
    borderRadius: 10,
    padding: 12,
    fontFamily: "Cairo_400Regular",
    fontSize: 14,
    color: "#1C2B2A",
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#E0E8E7",
  },
  severityRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  sevBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#E8EDEC",
  },
  sevText: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#1C2B2A" },
  submitBtn: {
    backgroundColor: "#1C2B2A",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#C9A84C" },

  sectionTitle: {
    fontFamily: "Cairo_700Bold", fontSize: 15, color: "#1C2B2A",
    textAlign: "right", marginBottom: 10,
  },
  empty: { fontFamily: "Cairo_400Regular", fontSize: 14, color: "#7A8A89", textAlign: "center", marginTop: 20 },

  reportRow: {
    flexDirection: "row-reverse",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderRightWidth: 4,
    borderRightColor: "#E0E8E7",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  sevDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  reportNote: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#1C2B2A", textAlign: "right" },
  reportDate: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#7A8A89", textAlign: "right", marginTop: 4 },
});
