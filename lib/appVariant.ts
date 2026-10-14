import Constants from "expo-constants";

// "mizoprovider" = the standalone Malaaz Provider app (opens straight on the provider portal).
export const IS_PROVIDER_APP = Constants.expoConfig?.extra?.appVariant === "mizoprovider";
