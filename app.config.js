const isMizoTest = process.env.APP_VARIANT === "mizotest";

module.exports = ({ config }) => ({
  ...config,
  name: isMizoTest ? "Malaaz ReVoice" : config.name,
  android: {
    ...config.android,
    package: isMizoTest
      ? "com.malaaz.homecare.mizotest"
      : config.android.package,
  },
  plugins: [
    ...(config.plugins ?? []),
    [
      "react-native-fbsdk-next",
      {
        appID: process.env.FACEBOOK_APP_ID ?? "",
        clientToken: process.env.FACEBOOK_CLIENT_TOKEN ?? "",
        displayName: isMizoTest ? "Malaaz ReVoice" : "ملاذ",
        scheme: `fb${process.env.FACEBOOK_APP_ID ?? ""}`,
        advertiserIDCollectionEnabled: false,
        autoLogAppEventsEnabled: true,
        isAutoInitEnabled: true,
      },
    ],
  ],
});
