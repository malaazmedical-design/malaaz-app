const isMizoTest = process.env.APP_VARIANT === "mizotest";

module.exports = ({ config }) => ({
  ...config,
  name: isMizoTest ? "ميزو ملاذ" : config.name,
  android: {
    ...config.android,
    package: isMizoTest
      ? "com.malaaz.homecare.mizotest"
      : config.android.package,
  },
});
