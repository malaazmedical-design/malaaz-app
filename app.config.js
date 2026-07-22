const isMizoTest = process.env.APP_VARIANT === "mizotest";

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    package: isMizoTest
      ? "com.malaaz.homecare.mizotest"
      : config.android.package,
    // mizo-test مش محتاج Firebase — بيشيل google-services عشان الـ package name مختلف
    ...(isMizoTest ? { googleServicesFile: undefined } : {}),
  },
  plugins: isMizoTest
    ? (config.plugins ?? []).filter(
        (p) => !(Array.isArray(p) ? p[0] : p).toString().includes("notifications")
      )
    : config.plugins,
});
