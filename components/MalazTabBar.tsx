import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TJ, useMalaz } from "@/constants/malazTheme";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const ICONS: Record<string, IconName> = {
  index: "home-variant-outline",
  bookings: "calendar-check-outline",
  profile: "account-circle-outline",
};

// Floating capsule navigation from the Malaz Home handoff.
// Routes without an icon (e.g. the hidden mizo-entry tab) are skipped.
export default function MalazTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useMalaz();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(insets.bottom, 0) + 18, alignItems: "center" }}
    >
      <View
        style={{
          flexDirection: "row-reverse",
          alignItems: "center",
          padding: 8,
          gap: 4,
          borderRadius: 40,
          backgroundColor: t.nav,
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 10 },
          elevation: 12,
        }}
      >
        {state.routes.map((route, index) => {
          const icon = ICONS[route.name];
          if (!icon) return null;
          const focused = state.index === index;
          const label = descriptors[route.key].options.title ?? route.name;

          const onPress = () => {
            if (Platform.OS !== "web") Haptics.selectionAsync();
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              style={{
                height: 48,
                minWidth: 48,
                paddingHorizontal: focused ? 20 : 0,
                borderRadius: 24,
                flexDirection: "row-reverse",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                backgroundColor: focused ? t.gold : "transparent",
              }}
            >
              <MaterialCommunityIcons name={icon} size={22} color={focused ? t.onGold : t.muted} />
              {focused ? (
                <Text style={{ fontFamily: TJ.heavy, fontSize: 14, color: t.onGold }}>{label}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
