import { useColorScheme } from "react-native";

// Design tokens for the redesigned (Malaz Home handoff) client UI.
// Kept separate from constants/colors.ts so screens not yet redesigned are unaffected.
const dark = {
  bg: "#0b1514",
  hdr: "#1b2a29",
  card: "#16231f",
  border: "#2a3a36",
  btn: "#2a3a39",
  ic: "#243433",
  ic2: "#1d2b2a",
  nav: "#111d1b",
  text: "#f2efe6",
  text2: "#cfd6d3",
  muted: "#8fa09d",
  selected: "#2a3a2c",
};

const light = {
  bg: "#f4f1ea",
  hdr: "#ffffff",
  card: "#ffffff",
  border: "#e3ddcf",
  btn: "#ece7da",
  ic: "#f0ebdd",
  ic2: "#e6e0cf",
  nav: "#ffffff",
  text: "#1e2d31",
  text2: "#3b4a4e",
  muted: "#66767a",
  selected: "#f6edd0",
};

export const MALAZ_COMMON = {
  gold: "#c9a84c",
  onGold: "#10201f",
  onGoldSub: "#5c5326",
  goldRing: "#6b5d2c",
  goldTint: "rgba(201,168,76,.14)",
  online: "#1fa65a",
  offline: "#6b7a7c",
  destructive: "#e5484d",
  whatsapp: "#25D366",
};

export const TJ = {
  regular: "Tajawal_400Regular",
  medium: "Tajawal_500Medium",
  bold: "Tajawal_700Bold",
  heavy: "Tajawal_800ExtraBold",
} as const;

export function useMalaz() {
  const isDark = useColorScheme() === "dark";
  return { ...(isDark ? dark : light), ...MALAZ_COMMON, isDark };
}
