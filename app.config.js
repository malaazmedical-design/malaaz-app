const fs = require("fs");

const isMizoTest = process.env.APP_VARIANT === "mizotest";
const isProviderApp = process.env.APP_VARIANT === "mizoprovider";

const PROVIDER_PACKAGE = "com.malaaz.homecare.malaazprovider";

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

module.exports = ({ config }) => {
  const androidPackage = isProviderApp
    ? PROVIDER_PACKAGE
    : isMizoTest
      ? "com.malaaz.homecare.mizotest"
      : config.android.package;

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
    android: {
      ...config.android,
      package: androidPackage,
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
      ...(config.plugins ?? []).map((p) =>
        isProviderApp && Array.isArray(p) && p[0] === "expo-splash-screen"
          ? ["expo-splash-screen", { ...p[1], backgroundColor: "#F4F1EA", image: "./assets/images/provider/splash-icon.png" }]
          : p,
      ),
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
