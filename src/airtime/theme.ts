/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

const tintColorLight = "#0a7ea4";
const tintColorDark = "#fff";

export const Colors = {
  light: {
    text: "#11181C",
    background: "#fff",
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#ECEDEE",
    background: "#151718",
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
  },
};

/**
 * Design tokens for the Sell Airtime screen. Remapped to match the rest of the
 * POS (light surfaces, blue primary) instead of ScanIt's original dark theme.
 * `background` doubles as the screen fill AND the text/icon colour that sits on
 * top of `accent` buttons, so it stays light to read on the blue accent.
 */

export const Palette = {
  background: "#f5f6f8", // app background + on-accent text (light on blue)
  card: "#ffffff",
  input: "#f1f3f5",
  border: "#e6e8ec",
  accent: "#3b5bdb", // POS primary blue (main call-to-action)
  text: "#1a2230",
  textMuted: "#6b7280",
  danger: "#e03131",
};

export const Radius = {
  card: 16,
  chip: 10,
  button: 14,
  icon: 8,
};

export const Mono = Platform.select({
  ios: "ui-monospace",
  android: "monospace",
  default: "monospace",
});

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
