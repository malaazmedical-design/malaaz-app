import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { TJ, useMalaz } from "@/constants/malazTheme";

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const t = useMalaz();
  return (
    <Pressable
      onPress={() => onChange(!on)}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={{ width: 46, height: 27, borderRadius: 14, backgroundColor: on ? t.gold : t.btn, justifyContent: "center", paddingHorizontal: 3, alignItems: on ? "flex-end" : "flex-start" }}
    >
      <View style={{ width: 21, height: 21, borderRadius: 11, backgroundColor: "#fff" }} />
    </Pressable>
  );
}

export function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useMalaz();
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ color: t.muted, fontFamily: TJ.heavy, fontSize: 13, textAlign: "right", marginBottom: 8, paddingHorizontal: 4 }}>{label}</Text>
      <View style={{ backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.border, overflow: "hidden" }}>{children}</View>
    </View>
  );
}

export function Row({ icon, title, value, onPress, danger, toggle, last }: {
  icon: IconName; title: string; value?: string; onPress?: () => void; danger?: boolean;
  toggle?: { on: boolean; onChange: (v: boolean) => void }; last?: boolean;
}) {
  const t = useMalaz();
  const color = danger ? t.destructive : t.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: "row-reverse", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: t.border,
        backgroundColor: pressed ? t.ic : "transparent",
      })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: danger ? "rgba(229,72,77,.14)" : t.ic, alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name={icon} size={19} color={danger ? t.destructive : t.gold} />
      </View>
      <Text style={{ flex: 1, color, fontFamily: TJ.bold, fontSize: 14.5, textAlign: "right" }}>{title}</Text>
      {value ? <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5 }}>{value}</Text> : null}
      {toggle ? <Toggle {...toggle} /> : onPress ? <MaterialCommunityIcons name="chevron-left" size={20} color={t.muted} /> : null}
    </Pressable>
  );
}

export function GoldButton({ label, onPress, disabled, outline, icon, flex }: {
  label: string; onPress: () => void; disabled?: boolean; outline?: boolean; icon?: IconName; flex?: boolean;
}) {
  const t = useMalaz();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: flex ? 1 : undefined, height: 50, borderRadius: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8,
        backgroundColor: outline ? "transparent" : t.gold, borderWidth: outline ? 1.5 : 0, borderColor: t.gold,
        opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={18} color={outline ? t.gold : t.onGold} /> : null}
      <Text style={{ color: outline ? t.gold : t.onGold, fontFamily: TJ.heavy, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function BenefitRow({ icon, title, desc, badge, hot, last }: {
  icon: IconName; title: string; desc: string; badge?: string; hot?: boolean; last?: boolean;
}) {
  const t = useMalaz();
  return (
    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.border }}>
      {hot ? (
        <LinearGradient colors={["#d9bb5e", "#a98a30"]} style={{ width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={icon} size={21} color={t.onGold} />
        </LinearGradient>
      ) : (
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: t.ic, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={icon} size={21} color={t.gold} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
          <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 14.5 }}>{title}</Text>
          {badge ? (
            <View style={{ backgroundColor: t.gold, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 1 }}>
              <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 10.5 }}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginTop: 2 }}>{desc}</Text>
      </View>
    </View>
  );
}
