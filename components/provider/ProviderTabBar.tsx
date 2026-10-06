import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TJ, useMalaz } from "@/constants/malazTheme";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

// Routes without an entry (cases, services) stay reachable but hidden from the bar.
const ICONS: Record<string, IconName> = {
  overview: "view-dashboard-outline",
  bookings: "calendar-text-outline",
  offers: "email-outline",
  profile: "account-circle-outline",
};

export default function ProviderTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: "row-reverse",
        backgroundColor: t.nav,
        borderTopWidth: 1,
        borderTopColor: t.border,
        paddingTop: 8,
        paddingHorizontal: 6,
        paddingBottom: Math.max(insets.bottom, 12),
      }}
    >
      {state.routes.map((route, index) => {
        const icon = ICONS[route.name];
        if (!icon) return null;
        const focused = state.index === index;
        const { title, tabBarBadge } = descriptors[route.key].options;
        const color = focused ? t.gold : t.muted;
        const onPress = () => {
          if (Platform.OS !== "web") Haptics.selectionAsync();
          const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !ev.defaultPrevented) navigation.navigate(route.name as never);
        };
        return (
          <Pressable key={route.key} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: focused }}
            style={({ pressed }) => ({ flex: 1, alignItems: "center", paddingVertical: 4, opacity: pressed ? 0.7 : 1 })}>
            <View>
              <MaterialCommunityIcons name={icon} size={24} color={color} />
              {tabBarBadge ? (
                <View style={{ position: "absolute", top: -4, left: -10, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: t.gold, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 12, lineHeight: 16 }}>{tabBarBadge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color, fontFamily: TJ.heavy, fontSize: 12, marginTop: 2 }}>{title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
