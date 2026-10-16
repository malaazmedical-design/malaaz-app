const fs = require("fs");

const isMizoTest = process.env.APP_VARIANT === "mizotest";
const isProviderApp = process.env.APP_VARIANT === "mizoprovider";

const PROVIDER_PACKAGE = "com.malaaz.homecare.malaazprovider";
const MIZO_TEST_PACKAGE = "com.malaaz.homecare.mizotest";

// google-services.json only works for packages registered in Firebase. When the package of a variant is not in
// the file yet (e.g. the provider app before it is added in Firebase) we build without it: the app works,
// only Android push notifications stay off until the Firebase app is added and the file is replaced.
function googleServicesFor(pkg, file) {
  try {
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    const ok = (d.client ?? []).some((c) => c.client_info?.android_client_info?.package_name === pkg);
    return ok ? file : undefined;
  } catch {
    return undefined;
  }
}

// Voice/video consultations (LiveKit) ship in every variant, including the store build of the original app after the merge.
const withCalls = true;

// Firebase Analytics (Android) for the store app (com.malaaz.app, registered in google-services.json and in a Google Analytics
// stream). Current google-services.json files carry no analytics_service entry, so the package alone is the switch. iOS builds skip it.
function firebaseAnalyticsEnabled(file) {
  if (isProviderApp || isMizoTest) return false;
  if (process.env.EAS_BUILD_PLATFORM === "ios") return false;
  try {
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    return (d.client ?? []).some(
      (c) => c.client_info?.android_client_info?.package_name === "com.malaaz.app"
    );
  } catch {
    return false;
  }
}

module.exports = ({ config }) => {
  const withFirebaseAnalytics = firebaseAnalyticsEnabled(config.android?.googleServicesFile ?? "./google-services.json");
  const androidPackage = isProviderApp
    ? PROVIDER_PACKAGE
    : isMizoTest
      ? MIZO_TEST_PACKAGE
      : config.android.package;
  // The iOS variants get their own bundle identifiers too (same ids as Android), so they never collide with the original app
  // (com.malaaz.app) in App Store Connect / TestFlight. The original app keeps the id from app.json.
  const iosBundleId = isProviderApp ? PROVIDER_PACKAGE : isMizoTest ? MIZO_TEST_PACKAGE : config.ios?.bundleIdentifier;

  return {
    ...config,
    name: isProviderApp ? "Malaaz Provider" : isMizoTest ? "Malaaz ReVoice" : config.name,
    // own deep-link scheme so the test builds and the original app never fight over links
    scheme: isProviderApp ? "malaaz-provider" : isMizoTest ? "malaaz-revoice" : config.scheme,
    icon: isProviderApp ? "./assets/images/provider/icon.png" : config.icon,
    splash: isProviderApp
      ? { ...config.splash, image: "./assets/images/provider/splash-icon.png", backgroundColor: "#F4F1EA" }
      : config.splash,
    web: isProviderApp ? { ...config.web, favicon: "./assets/images/provider/favicon.png" } : config.web,
    ios: {
      ...config.ios,
      bundleIdentifier: iosBundleId,
      infoPlist: {
        ...config.ios?.infoPlist,
        ...(withCalls
          ? {
              NSCameraUsageDescription: "التطبيق يحتاج الكاميرا لمكالمات الفيديو مع الطبيب",
              NSMicrophoneUsageDescription: "التطبيق يحتاج المايك لمكالمات الصوت والفيديو مع الطبيب",
            }
          : {}),
      },
    },
    android: {
      ...config.android,
      package: androidPackage,
      permissions: [
        ...(config.android?.permissions ?? []),
        ...(withCalls
          ? [
              "android.permission.CAMERA",
              "android.permission.MODIFY_AUDIO_SETTINGS",
              "android.permission.BLUETOOTH",
              "android.permission.BLUETOOTH_CONNECT",
              "android.permission.ACCESS_NETWORK_STATE",
              "android.permission.WAKE_LOCK",
            ]
          : []),
      ],
      ...(isProviderApp
        ? {
            adaptiveIcon: {
              foregroundImage: "./assets/images/provider/adaptive-icon.png",
              backgroundColor: "#F4F1EA",
            },
          }
        : {}),
      googleServicesFile:
        isProviderApp || isMizoTest
          ? googleServicesFor(androidPackage, config.android.googleServicesFile)
          : config.android.googleServicesFile,
    },
    extra: { ...config.extra, appVariant: process.env.APP_VARIANT ?? "main" },
    plugins: [
      ...(config.plugins ?? []).map((p) => {
        if (isProviderApp && Array.isArray(p) && p[0] === "expo-splash-screen") {
          return ["expo-splash-screen", { ...p[1], backgroundColor: "#F4F1EA", image: "./assets/images/provider/splash-icon.png" }];
        }
        return p;
      }),
      ...(withCalls ? ["@livekit/react-native-expo-plugin"] : []),
      ...(withFirebaseAnalytics ? ["@react-native-firebase/app", "@react-native-firebase/analytics"] : []),
      ...(process.env.FACEBOOK_APP_ID
        ? [[
            "react-native-fbsdk-next",
            {
              appID: process.env.FACEBOOK_APP_ID,
              clientToken: process.env.FACEBOOK_CLIENT_TOKEN ?? "",
              displayName: isProviderApp ? "Malaaz Provider" : isMizoTest ? "Malaaz ReVoice" : "ملاذ",
              scheme: `fb${process.env.FACEBOOK_APP_ID}`,
              advertiserIDCollectionEnabled: false,
              autoLogAppEventsEnabled: true,
              isAutoInitEnabled: true,
            },
          ]]
        : []),
    ],
  };
};
