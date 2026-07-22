module.exports = ({ config }) => ({
  ...config,
  name: isMizoTest ? "ميزو ملاذ" : config.name,
  android: {
    ...config.android,
    package: process.env.APP_VARIANT === "mizotest"
      ? "com.malaaz.homecare.mizotest"
      : config.android.package,
  },
});
