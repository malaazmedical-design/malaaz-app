import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, PrimaryButton } from "@/components/ui";
import { getProviderById, getServiceById } from "@/constants/data";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

const RATING_LABELS = ["ضعيف", "مقبول", "جيد", "جيد جداً", "ممتاز"];
const QUICK_COMMENTS = [
  "خدمة ممتازة وسريعة",
  "الدكتور محترف ومتعاون",
  "جاء في الموعد المحدد",
  "أنصح به بشدة",
  "سأحجز مرة أخرى",
];

export default function RateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { bookings, addReview } = useApp();

  const booking = bookings.find((b) => b.id === bookingId);
  const provider = booking ? getProviderById(booking.providerId) : undefined;
  const service = booking ? getServiceById(booking.serviceId) : undefined;

  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const activeStar = hoveredStar || rating;

  if (!booking || !provider || !service) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_500Medium" }}>الحجز غير موجود</Text>
      </View>
    );
  }

  const handleSubmit = async () => {
    if (rating === 0) return;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSubmitting(true);
    try {
      await addReview(booking.id, {
        rating,
        comment: comment.trim(),
        createdAt: new Date().toISOString(),
      });
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScrollView
        bottomOffset={120}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.primary, "#0d5e58"]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            paddingTop: insets.top + 20 + webTopInset,
            paddingBottom: 60,
            paddingHorizontal: 20,
          }}
        >
          <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: "#FFFFFF22",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons name="chevron-right" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={{ color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 17 }}>
              تقييم الزيارة
            </Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 16, marginTop: -36 }}>
          <Card style={{
            padding: 20,
            shadowColor: "#000",
            shadowOpacity: 0.08,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
          }}>
            <View style={{ flexDirection: "row-reverse", gap: 14, alignItems: "center" }}>
              <Image
                source={provider.avatar}
                style={{ width: 68, height: 68, borderRadius: 18, backgroundColor: colors.surfaceMuted }}
                contentFit="cover"
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right" }}>
                  {provider.name}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right", marginTop: 2 }}>
                  {service.name}
                </Text>
              </View>
            </View>

            <View style={{
              marginTop: 24,
              alignItems: "center",
              paddingVertical: 24,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}>
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 18, marginBottom: 6 }}>
                كيف كانت تجربتك؟
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 13, marginBottom: 20 }}>
                {activeStar > 0 ? RATING_LABELS[activeStar - 1] : "اضغط على النجوم للتقييم"}
              </Text>

              <View style={{ flexDirection: "row", gap: 12 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    onPress={() => {
                      setRating(star);
                      if (Platform.OS !== "web") {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    onPressIn={() => setHoveredStar(star)}
                    onPressOut={() => setHoveredStar(0)}
                    style={({ pressed }) => ({ transform: [{ scale: pressed ? 1.2 : star <= activeStar ? 1.1 : 1 }] })}
                  >
                    <MaterialCommunityIcons
                      name={star <= activeStar ? "star" : "star-outline"}
                      size={44}
                      color={star <= activeStar ? colors.accent : colors.border}
                    />
                  </Pressable>
                ))}
              </View>

              {rating > 0 ? (
                <View style={{
                  marginTop: 10,
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                  backgroundColor: `${colors.accent}15`,
                  borderRadius: 99,
                }}>
                  <Text style={{ color: colors.accent, fontFamily: "Cairo_700Bold", fontSize: 14 }}>
                    {RATING_LABELS[rating - 1]}
                  </Text>
                </View>
              ) : null}
            </View>
          </Card>

          {rating > 0 ? (
            <Card style={{ marginTop: 14, padding: 18 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 15, textAlign: "right", marginBottom: 12 }}>
                أضف تعليقاً (اختياري)
              </Text>

              <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {QUICK_COMMENTS.map((qc) => (
                  <Pressable
                    key={qc}
                    onPress={() => setComment((prev) => prev ? prev + "، " + qc : qc)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 99,
                      borderWidth: 1,
                      borderColor: comment.includes(qc) ? colors.primary : colors.border,
                      backgroundColor: comment.includes(qc) ? `${colors.primary}10` : colors.card,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    })}
                  >
                    <Text style={{
                      color: comment.includes(qc) ? colors.primary : colors.foreground,
                      fontFamily: "Cairo_500Medium",
                      fontSize: 12,
                    }}>
                      {qc}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="اكتب تعليقك هنا..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: 14,
                  padding: 14,
                  textAlign: "right",
                  textAlignVertical: "top",
                  fontFamily: "Cairo_400Regular",
                  fontSize: 14,
                  color: colors.foreground,
                  minHeight: 100,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
            </Card>
          ) : null}

          <View style={{ marginTop: 20 }}>
            <PrimaryButton
              label={submitting ? "جاري الإرسال..." : rating === 0 ? "اختر تقييمك أولاً" : "إرسال التقييم"}
              icon={submitting ? undefined : "send"}
              onPress={handleSubmit}
              disabled={rating === 0 || submitting}
              loading={submitting}
            />
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
