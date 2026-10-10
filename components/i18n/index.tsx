import React from "react";
import { Text as RNText, TextInput as RNTextInput, TextInputProps, TextProps } from "react-native";

import { tr, useLang } from "@/lib/i18n";

const mapChildren = (c: React.ReactNode): React.ReactNode => {
  if (typeof c === "string") return tr(c);
  if (Array.isArray(c)) return c.map((x, i) => (typeof x === "string" ? tr(x) : x));
  return c;
};

// Drop-in replacements for react-native's Text / TextInput: Arabic strings are translated when the app language is English.
export const Text = React.forwardRef<RNText, TextProps>(function Text({ children, ...rest }, ref) {
  useLang();
  return <RNText ref={ref} {...rest}>{mapChildren(children)}</RNText>;
});

export const TextInput = React.forwardRef<RNTextInput, TextInputProps>(function TextInput({ placeholder, ...rest }, ref) {
  useLang();
  return <RNTextInput ref={ref} placeholder={placeholder ? tr(placeholder) : placeholder} {...rest} />;
});
