import { useWindowDimensions } from "react-native";

export const TABLET_BREAKPOINT = 768;
export const MAX_CONTENT_WIDTH = 720;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const isLandscape = width > height;

  // Horizontal padding used inside ScreenContainer
  const hPad = isTablet ? 24 : 0;

  // Usable content width after ScreenContainer centering + padding
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - hPad * 2;

  // Calculate item width for N-column grids given a gap
  function colWidth(cols: number, gap = 12) {
    return (contentWidth - gap * (cols - 1)) / cols;
  }

  return { width, height, isTablet, isLandscape, contentWidth, colWidth };
}
