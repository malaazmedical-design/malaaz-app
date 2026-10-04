const isMizoTest = process.env.APP_VARIANT === "mizotest";

module.exports = ({ config }) => ({
  ...config,
  name: isMizoTest ? "Malaaz ReVoice" : config.name,
  // own deep-link scheme so the test build and the original app never fight over links
  scheme: isMizoTest ? "malaaz-revoice" : config.scheme,
  android: {
    ...config.android,
    package: isMizoTest
      ? "com.malaaz.homecare.mizotest"
      : config.android.package,
  },
  plugins: [
    ...(config.plugins ?? []),
    ...(process.env.FACEBOOK_APP_ID
      ? [[
          "react-native-fbsdk-next",
          {
            appID: process.env.FACEBOOK_APP_ID,
            clientToken: process.env.FACEBOOK_CLIENT_TOKEN ?? "",
            displayName: isMizoTest ? "Malaaz ReVoice" : "ملاذ",
            scheme: `fb${process.env.FACEBOOK_APP_ID}`,
            advertiserIDCollectionEnabled: false,
            autoLogAppEventsEnabled: true,
            isAutoInitEnabled: true,
          },
        ]]
      : []),
  ],
});
