module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    package: process.env.APP_VARIANT === "mizotest"
      ? "com.malaaz.homecare.mizotest"
      : config.android.package,
  },
});
