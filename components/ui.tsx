import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline" | "destructive";
  icon?: IconName;
  style?: ViewStyle;
}) {
  const colors = useColors();
  const isDisabled = disabled || loading;

  const palette = (() => {
    switch (variant) {
      case "secondary":
        return {
          bg: colors.secondary,
          fg: colors.secondaryForeground,
          border: "transparent",
        };
      case "outline":
        return {
          bg: "transparent",
          fg: colors.primary,
          border: colors.primary,
        };
      case "destructive":
        return {
          bg: colors.destructive,
          fg: colors.destructiveForeground,
          border: "transparent",
        };
      default:
        return {
          bg: colors.primary,
          fg: colors.primaryForeground,
          border: "transparent",
        };
    }
  })();

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
      }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === "outline" ? 1.5 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.btnInner}>
          {icon ? (
            <MaterialCommunityIcons name={icon} size={20} color={palette.fg} />
          ) : null}
          <Text
            style={[styles.btnText, { color: palette.fg }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: 20,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Pill({
  label,
  icon,
  tone = "default",
}: {
  label: string;
  icon?: IconName;
  tone?: "default" | "success" | "warning" | "info";
}) {
  const colors = useColors();
  const palette = (() => {
    switch (tone) {
      case "success":
        return { bg: "#DCFCE7", fg: "#166534" };
      case "warning":
        return { bg: "#FEF3C7", fg: "#92400E" };
      case "info":
        return { bg: "#DBEAFE", fg: "#1E40AF" };
      default:
        return { bg: colors.surfaceMuted, fg: colors.mutedForeground };
    }
  })();
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      {icon ? (
        <MaterialCommunityIcons name={icon} size={12} color={palette.fg} />
      ) : null}
      <Text
        style={{
          color: palette.fg,
          fontFamily: "Inter_600SemiBold",
          fontSize: 11,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onActionPress,
}: {
  title: string;
  action?: string;
  onActionPress?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text
        style={{
          color: colors.foreground,
          fontFamily: "Inter_700Bold",
          fontSize: 18,
          textAlign: "right",
          flex: 1,
        }}
      >
        {title}
      </Text>
      {action ? (
        <Pressable onPress={onActionPress}>
          <Text
            style={{
              color: colors.primary,
              fontFamily: "Inter_600SemiBold",
              fontSize: 13,
            }}
          >
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: IconName;
  title: string;
  message: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <MaterialCommunityIcons
          name={icon}
          size={32}
          color={colors.mutedForeground}
        />
      </View>
      <Text
        style={{
          color: colors.foreground,
          fontFamily: "Inter_700Bold",
          fontSize: 16,
          textAlign: "center",
          marginBottom: 4,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.mutedForeground,
          fontFamily: "Inter_400Regular",
          fontSize: 13,
          textAlign: "center",
          lineHeight: 20,
          maxWidth: 260,
        }}
      >
        {message}
      </Text>
    </View>
  );
}

export function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 6 }}>
      <Text
        style={{
          color: colors.foreground,
          fontFamily: "Inter_600SemiBold",
          fontSize: 13,
          textAlign: "right",
        }}
      >
        {label}
      </Text>
      {hint ? (
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 11,
            textAlign: "right",
            marginTop: 2,
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const colors = useColors();
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  return (
    <View style={{ flexDirection: "row", gap: 1 }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const name: IconName =
          i < full
            ? "star"
            : i === full && hasHalf
              ? "star-half-full"
              : "star-outline";
        return (
          <MaterialCommunityIcons
            key={i}
            name={name}
            size={size}
            color={colors.accent}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  btnInner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  btnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  } as TextStyle,
  card: {
    borderWidth: 1,
    padding: 16,
  },
  pill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
});
