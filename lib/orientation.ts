import { Dimensions, Platform } from "react-native";
import Constants from "expo-constants";
import { requireOptionalNativeModule } from "expo-modules-core";

// The app allows rotation (required for large screens on Android 16+ and by Google Play).
// Phones stay portrait (the layouts are built for it); tablets rotate freely.
// The ReVoice test app has landscape layouts for its cards screens, so it rotates on every device.
export function applyOrientationPolicy() {
  if (Platform.OS === "web") return;
  try {
    // builds made before this module was added do not contain it: never load its JS there
    if (!requireOptionalNativeModule("ExpoScreenOrientation")) return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SO = require("expo-screen-orientation");
    const { width, height } = Dimensions.get("screen");
    const isTablet = Math.min(width, height) >= 600;
    const variant = (Constants.expoConfig?.extra as { appVariant?: string } | undefined)?.appVariant;
    if (isTablet || variant === "mizotest") {
      SO.unlockAsync().catch(() => {});
    } else {
      SO.lockAsync(SO.OrientationLock.PORTRAIT_UP).catch(() => {});
    }
  } catch {}
}
