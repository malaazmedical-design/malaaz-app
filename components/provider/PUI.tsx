import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Animated, FlatList, LayoutChangeEvent, Modal, PanResponder, Pressable, StyleSheet, Text, TextInput, TextProps, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { normalizeArabic } from "@/constants/data";

import { TJ, useMalaz } from "@/constants/malazTheme";
import { useProviderPrefs } from "@/lib/providerPrefs";

// Text that honours the provider's "حجم الخط" setting.
export function PText({ style, ...rest }: TextProps) {
  const { fontScale } = useProviderPrefs();
  const flat = StyleSheet.flatten(style) ?? {};
  const scaled = typeof flat.fontSize === "number" ? { fontSize: Math.round(flat.fontSize * fontScale * 10) / 10 } : null;
  return <Text {...rest} style={[style, scaled]} />;
}

// ─── Swipe-to-confirm (drag the gold knob to the left past 75%) ───────────────
export function SwipeButton({ label, onConfirm, height = 50 }: { label: string; onConfirm: () => void; height?: number }) {
  const t = useMalaz();
  const x = React.useRef(new Animated.Value(0)).current;
  const widthRef = React.useRef(0);
  const [hint, setHint] = React.useState(false);
  const knob = height - 8;
  const confirmRef = React.useRef(onConfirm);
  confirmRef.current = onConfirm;

  const pan = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          const max = Math.max(widthRef.current - knob - 8, 1);
          x.setValue(Math.max(-max, Math.min(0, g.dx)));
        },
        onPanResponderRelease: (_, g) => {
          const max = Math.max(widthRef.current - knob - 8, 1);
          if (Math.abs(g.dx) < 4) {
            setHint(true);
            setTimeout(() => setHint(false), 1400);
          } else if (-g.dx >= max * 0.75) {
            Animated.timing(x, { toValue: -max, duration: 90, useNativeDriver: true }).start(() => {
              confirmRef.current();
              setTimeout(() => x.setValue(0), 400);
            });
            return;
          }
          Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [knob, x],
  );

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => { widthRef.current = e.nativeEvent.layout.width; }}
      style={{ height, borderRadius: height / 2, backgroundColor: t.goldTint, borderWidth: 1.5, borderColor: t.goldRing, overflow: "hidden", alignItems: "center", justifyContent: "center" }}
    >
      <PText style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 14, paddingHorizontal: knob + 8 }} numberOfLines={1}>
        {hint ? "اسحب لليسار للتأكيد" : label}
      </PText>
      <Animated.View
        {...pan.panHandlers}
        style={{ position: "absolute", right: 4, top: 4, width: knob, height: knob, borderRadius: knob / 2, backgroundColor: t.gold, alignItems: "center", justifyContent: "center", transform: [{ translateX: x }] }}
      >
        <MaterialCommunityIcons name="chevron-left" size={24} color={t.onGold} />
      </Animated.View>
    </View>
  );
}

// ─── Animated check burst (1.4s) ──────────────────────────────────────────────
export function useCheckBurst() {
  const [msg, setMsg] = React.useState<string | null>(null);
  const scale = React.useRef(new Animated.Value(0.6)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = React.useCallback((m: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg(m);
    scale.setValue(0.6);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    timer.current = setTimeout(() => setMsg(null), 1400);
  }, [opacity, scale]);

  const node = msg ? <CheckBurstView msg={msg} scale={scale} opacity={opacity} /> : null;
  return { show, node };
}

function CheckBurstView({ msg, scale, opacity }: { msg: string; scale: Animated.Value; opacity: Animated.Value }) {
  const t = useMalaz();
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,.35)", zIndex: 50 }}>
      <Animated.View style={{ opacity, transform: [{ scale }], backgroundColor: t.card, borderRadius: 28, paddingVertical: 26, paddingHorizontal: 36, alignItems: "center", gap: 12, borderWidth: 1, borderColor: t.border }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.online, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="check" size={38} color="#fff" />
        </View>
        <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 16 }}>{msg}</PText>
      </Animated.View>
    </View>
  );
}

// ─── Price slider (RTL: min on the right, step 10) ────────────────────────────
export function PriceSlider({ value, min, max, step = 10, onChange, disabled }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void; disabled?: boolean;
}) {
  const t = useMalaz();
  const [w, setW] = React.useState(0);
  const cb = React.useRef(onChange);
  cb.current = onChange;
  const range = Math.max(max - min, 1);
  const frac = Math.min(1, Math.max(0, (value - min) / range));

  const setFromX = React.useCallback((x: number, width: number) => {
    if (width <= 0) return;
    const f = 1 - Math.min(1, Math.max(0, x / width));
    const raw = min + f * (max - min);
    const snapped = Math.round(raw / step) * step;
    cb.current(Math.min(max, Math.max(min, snapped)));
  }, [min, max, step]);

  const pan = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX, w),
        onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX, w),
      }),
    [disabled, setFromX, w],
  );

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      {...pan.panHandlers}
      style={{ height: 34, justifyContent: "center", marginTop: 6 }}
    >
      <View pointerEvents="none" style={{ height: 6, borderRadius: 3, backgroundColor: t.btn }}>
        <View style={{ position: "absolute", right: 0, height: 6, borderRadius: 3, width: `${frac * 100}%`, backgroundColor: t.gold }} />
      </View>
      <View pointerEvents="none" style={{ position: "absolute", right: Math.max(0, frac * (w - 22)), width: 22, height: 22, borderRadius: 11, backgroundColor: t.gold, borderWidth: 3, borderColor: t.card }} />
    </View>
  );
}

// ─── Custom dropdown (trigger + inline list with ✓ on the selected item) ──────
export function Select({ label, value, options, onChange, placeholder = "اختر" }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; placeholder?: string;
}) {
  const t = useMalaz();
  const [open, setOpen] = React.useState(false);
  return (
    <View>
      <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "right", marginHorizontal: 4, marginBottom: 6 }}>{label}</PText>
      <Pressable
        onPress={() => setOpen(!open)}
        style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: open ? t.gold : t.border, backgroundColor: t.card, paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}
      >
        <PText style={{ color: value ? t.text : t.muted, fontFamily: TJ.medium, fontSize: 15 }}>{value || placeholder}</PText>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={20} color={t.muted} />
      </Pressable>
      {open ? (
        <View style={{ marginTop: 6, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, overflow: "hidden" }}>
          {options.map((o, i) => (
            <Pressable key={o} onPress={() => { onChange(o); setOpen(false); }}
              style={({ pressed }) => ({ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, backgroundColor: pressed ? t.ic : "transparent", borderBottomWidth: i === options.length - 1 ? 0 : 1, borderBottomColor: t.border })}>
              <PText style={{ color: t.text, fontFamily: o === value ? TJ.heavy : TJ.medium, fontSize: 15 }}>{o}</PText>
              {o === value ? <PText style={{ color: t.goldText, fontFamily: TJ.heavy, fontSize: 16 }}>✓</PText> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}


// ─── Field that opens a searchable bottom sheet (for long lists like specialties) ─
export function SearchableSelect({ label, hint, value, options, onChange, placeholder = "اختر", sheetTitle }: {
  label: string; hint?: string; value: string; options: string[]; onChange: (v: string) => void; placeholder?: string; sheetTitle?: string;
}) {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const nq = normalizeArabic(q.trim());
  const list = nq ? options.filter((o) => normalizeArabic(o).includes(nq)) : options;

  const close = () => { setOpen(false); setQ(""); };
  return (
    <View>
      <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13.5, textAlign: "right", marginHorizontal: 4, marginBottom: hint ? 2 : 6 }}>{label}</PText>
      {hint ? <PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginHorizontal: 4, marginBottom: 6 }}>{hint}</PText> : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={{ height: 52, borderRadius: 14, borderWidth: 1, borderColor: value ? t.goldRing : t.border, backgroundColor: t.card, paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}
      >
        <PText style={{ color: value ? t.text : t.muted, fontFamily: value ? TJ.heavy : TJ.medium, fontSize: 15 }}>{value || placeholder}</PText>
        <MaterialCommunityIcons name="chevron-down" size={22} color={t.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,.5)" }} onPress={close} />
        <View style={{ backgroundColor: t.hdr, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85%", paddingBottom: insets.bottom + 12 }}>
          <View style={{ alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: t.border, marginTop: 10 }} />
          <PText style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 19, textAlign: "center", marginTop: 12, marginBottom: 12 }}>{sheetTitle ?? label}</PText>
          <View style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 14, paddingHorizontal: 14, height: 46 }}>
            <MaterialCommunityIcons name="magnify" size={20} color={t.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="ابحث…"
              placeholderTextColor={t.muted}
              style={{ flex: 1, color: t.text, fontFamily: TJ.medium, fontSize: 15, textAlign: "right" }}
            />
            {q ? (
              <Pressable onPress={() => setQ("")} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={18} color={t.muted} /></Pressable>
            ) : null}
          </View>
          <FlatList
            data={list}
            keyExtractor={(o) => o}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
            ListEmptyComponent={<PText style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 14, textAlign: "center", paddingVertical: 30 }}>لا توجد نتائج</PText>}
            renderItem={({ item }) => {
              const on = item === value;
              return (
                <Pressable
                  onPress={() => { onChange(item); close(); }}
                  style={({ pressed }) => ({ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 15, borderRadius: 14, marginTop: 4, backgroundColor: on ? t.goldTint : pressed ? t.ic : "transparent" })}
                >
                  <PText style={{ color: on ? t.gold : t.text, fontFamily: on ? TJ.heavy : TJ.medium, fontSize: 15.5 }}>{item}</PText>
                  {on ? <MaterialCommunityIcons name="check" size={20} color={t.gold} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}
