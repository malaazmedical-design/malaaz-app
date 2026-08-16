import React from "react";
import { View, ViewStyle } from "react-native";
import { MAX_CONTENT_WIDTH, useResponsive } from "@/hooks/useResponsive";

export function ScreenContainer({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { isTablet } = useResponsive();
  return (
    <View
      style={[
        {
          width: "100%",
          maxWidth: MAX_CONTENT_WIDTH,
          alignSelf: "center",
          paddingHorizontal: isTablet ? 24 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
