import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, Pill, PrimaryButton, SectionHeader, Stars } from "@/components/ui";
import {
  Provider,
  SERVICE_CATEGORIES,
  ServiceType,
  getCategoryById,
  providerCities,
  ALL_CITIES,
} from "@/constants/data";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

type SortKey = "rating" | "price_asc" | "price_desc" | "experience";
type Filters = {
  minRating: number;
  maxPrice: number;
  onlyAvailable: boolean;
  sortBy: SortKey;
};
const DEFAULT_FILTERS: Filters = {
  minRating: 0,
  maxPrice: 9999,
  onlyAvailable: false,
  sortBy: "rating",
};
const SORT_OPTIONS: {
  key: SortKey;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
}[] = [
  { key: "rating",     label: "الأعلى تقييماً", icon: "star" },
  { key: "price_asc",  label: "السعر: الأقل",   icon: "arrow-up" },
  { key: "price_desc", label: "السعر: الأعلى",  icon: "arrow-down" },
  { key: "experience", label: "الأكثر خبرة",    icon: "medal" },
];
const FALLBACK_MAX_PRICE = 700;

function countActiveFilters(f: Filters, maxPriceLimit: number) {
  let n = 0;
  if (f.minRating > 0) n++;
  if (f.maxPrice < maxPriceLimit) n++;
  if (f.onlyAvailable) n++;
  if (f.sortBy !== "rating") n++;
  return n;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, providers, loadingProviders, coverageAreas } = useApp();
  const [serviceFilter, setServiceFilter] = useState<ServiceType | "all">("all");
  const [cityFilter, setCityFilter] = useState("الكل");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Filters>(DEFAULT_FILTERS);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const firstName = profile.name ? profile.name.split(" ")[0] : null;

  // أعلى سعر فعلي بين خدمات مقدمي الخدمة الحاليين، مقرّب لأقرب 50 ج.م
  const maxPriceLimit = useMemo(() => {
    const prices = providers.flatMap((p) => p.services.map((s) => s.price));
    if (!prices.length) return FALLBACK_MAX_PRICE;
    return Math.ceil(Math.max(...prices) / 50) * 50;
  }, [providers]);

  // درجات سعر متوسطة موزعة على المدى الفعلي للأسعار + السعر الأقصى نفسه
  const priceSteps = useMemo(() => {
    const stepCount = 5;
    const steps = new Set<number>();
    for (let i = 1; i < stepCount; i++) {
      const step = Math.round((maxPriceLimit * i) / stepCount / 50) * 50;
      if (step > 0) steps.add(step);
    }
    steps.add(maxPriceLimit);
    return Array.from(steps).sort((a, b) => a - b);
  }, [maxPriceLimit]);

  const activeCount = countActiveFilters(filters, maxPriceLimit);

  // أول ما البيانات تخلص تحميل: نحاول نحدد منطقة العميل تلقائياً ونرتب القائمة
  // على أساسها — مرة واحدة بس، وبهدوء (لو رفض الصلاحية أو فشل التحديد، الفلتر يفضل "الكل")
  const hasAutoLocatedRef = useRef(false);
  useEffect(() => {
    if (loadingProviders || hasAutoLocatedRef.current) return;
    hasAutoLocatedRef.current = true;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        const granted =
          status === "granted" ||
          (await Location.requestForegroundPermissionsAsync()).status === "granted";
        if (!granted) return;

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        const [geo] = await Location.reverseGeocodeAsync(loc.coords);
        const district = geo.district || geo.subregion || geo.city;
        if (!district) return;

        const match = coverageAreas.find(
          (a) => district.includes(a.name) || a.name.includes(district)
        );
        if (match && ALL_CITIES.includes(match.city)) {
          // ما نغيّرش الفلتر لو العميل غيّره يدوي وهو منتظر نتيجة تحديد الموقع
          setCityFilter((prev) => (prev === "الكل" ? match.city : prev));
        }
      } catch {
        // تعذّر تحديد الموقع — القائمة تفضل بدون فلتر مدينة (السلوك الافتراضي)
      }
    })();
  }, [loadingProviders, coverageAreas]);

  const filtered = useMemo(() => {
    let list: Provider[] = providers;
    if (serviceFilter !== "all") list = list.filter((p) => p.serviceType === serviceFilter);
    if (cityFilter !== "الكل") {
      // مطابقة ذكية: مناطق المقدم بتتترجم لمدينتها مهما كانت طريقة كتابتها،
      // واللي مدينته مش معروفة بيظهر في الحالتين بدل ما يختفي
      list = list.filter((p) => {
        const cities = providerCities(p.areas.length ? p.areas : [p.city], coverageAreas);
        return cities.size === 0 || cities.has(cityFilter);
      });
    }
    if (search.trim()) {
      const q = search.trim();
      list = list.filter((p) =>
        p.name.includes(q) || p.title.includes(q) || p.city.includes(q) ||
        p.areas.some((a) => a.includes(q))
      );
    }
    if (filters.minRating > 0) list = list.filter((p) => p.rating >= filters.minRating);
    if (filters.maxPrice < maxPriceLimit)
      list = list.filter((p) =>
        Math.min(...p.services.map((s) => s.price)) <= filters.maxPrice
      );
    if (filters.onlyAvailable) list = list.filter((p) => p.available);

    return [...list].sort((a, b) => {
      switch (filters.sortBy) {
        case "rating":     return b.rating - a.rating;
        case "price_asc":  return Math.min(...a.services.map((s) => s.price)) - Math.min(...b.services.map((s) => s.price));
        case "price_desc": return Math.min(...b.services.map((s) => s.price)) - Math.min(...a.services.map((s) => s.price));
        case "experience": return b.yearsExperience - a.yearsExperience;
      }
    });
  }, [serviceFilter, cityFilter, search, filters, providers, maxPriceLimit]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Header بهوية ملاذ ─── */}
        <LinearGradient
          colors={["#1C2B2A", "#243635"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 16 + webTopInset,
            paddingBottom: 28,
            paddingHorizontal: 20,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
          }}
        >
          {/* Logo + Bell */}
          <Animated.View entering={FadeInDown.duration(450)} style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <View>
              <Text style={{ color: "#C9A84C", fontFamily: "Cairo_700Bold", fontSize: 26, textAlign: "right" }}>
                ملاذ
              </Text>
              <Text style={{ color: "#FFFFFF99", fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right" }}>
                {firstName ? `أهلاً ${firstName} 👋` : "خدمات طبية منزلية"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => router.push("/profile")}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF15", alignItems: "center", justifyContent: "center" }}
              >
                <MaterialCommunityIcons name="account-outline" size={22} color="#C9A84C" />
              </Pressable>
            </View>
          </Animated.View>

          {/* ─── Flow 1: طلب سريع ─── */}
          <Animated.View entering={FadeInDown.delay(120).springify()}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/quick-request");
            }}
            style={({ pressed }) => ({
              backgroundColor: "#C9A84C",
              borderRadius: 18,
              padding: 16,
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "#FFFFFF25", alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name="lightning-bolt" size={26} color="#1C2B2A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#1C2B2A", fontFamily: "Cairo_700Bold", fontSize: 16 }}>
                طلب سريع 
              </Text>
              <Text style={{ color: "#1C2B2A99", fontFamily: "Cairo_400Regular", fontSize: 12, marginTop: 2 }}>
                اطلب الخدمة وإحنا نختارلك أفضل مزود
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-left" size={22} color="#1C2B2A" />
          </Pressable>
          </Animated.View>

          {/* Search + Filter */}
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderRadius: 14, paddingHorizontal: 14, height: 50 }}>
              <MaterialCommunityIcons name="magnify" size={20} color={colors.mutedForeground} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="ابحث عن طبيب أو ممرض..."
                placeholderTextColor={colors.mutedForeground}
                style={{ flex: 1, fontFamily: "Cairo_400Regular", fontSize: 14, color: colors.foreground, textAlign: "right" }}
              />
              {search.length > 0 ? (
                <Pressable onPress={() => setSearch("")}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={() => { setPendingFilters(filters); setShowFilterPanel(true); }}
              style={({ pressed }) => ({
                width: 50, height: 50, borderRadius: 14,
                backgroundColor: activeCount > 0 ? "#C9A84C" : "#FFFFFF22",
                alignItems: "center", justifyContent: "center",
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}
            >
              <MaterialCommunityIcons name="tune-variant" size={22} color={activeCount > 0 ? "#1C2B2A" : "#FFFFFF"} />
              {activeCount > 0 ? (
                <View style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#1C2B2A" }}>
                  <Text style={{ color: "#FFF", fontFamily: "Cairo_700Bold", fontSize: 10 }}>{activeCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </LinearGradient>

        {/* ─── Service Categories ─── */}
        <View style={{ paddingTop: 22 }}>
          <SectionHeader title="اختار الخدمة" />
          <View style={{ flexDirection: "row-reverse", paddingHorizontal: 16, gap: 8 }}>
            {SERVICE_CATEGORIES.map((cat, catIndex) => {
              const isActive = serviceFilter === cat.id;
              return (
                <Animated.View key={cat.id} entering={FadeInUp.delay(150 + catIndex * 90).springify()} style={{ flex: 1 }}>
                <Pressable
                  onPress={() => {
                    setServiceFilter(isActive ? "all" : (cat.id as ServiceType));
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => ({
                    padding: 12, borderRadius: 16, borderWidth: 1.5,
                    alignItems: "center",
                    backgroundColor: isActive ? "#1C2B2A" : colors.card,
                    borderColor: isActive ? "#C9A84C" : colors.border,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  })}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isActive ? "#C9A84C22" : "#1C2B2A12", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                    <MaterialCommunityIcons
                      name={cat.icon as React.ComponentProps<typeof MaterialCommunityIcons>["name"]}
                      size={22}
                      color={isActive ? "#C9A84C" : "#1C2B2A"}
                    />
                  </View>
                  <Text style={{ color: isActive ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 12, textAlign: "center" }}>
                    {cat.name}
                  </Text>
                  <Text numberOfLines={2} style={{ color: isActive ? "#FFFFFF88" : colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 10, textAlign: "center", marginTop: 3, lineHeight: 15 }}>
                    {cat.description}
                  </Text>
                </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </View>

        {/* ─── City Filter ─── */}
        <View style={{ paddingTop: 18 }}>
          <SectionHeader title="المدينة" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, flexDirection: "row-reverse" }}>
            {["الكل", ...ALL_CITIES].map((city) => {
              const isActive = cityFilter === city;
              return (
                <Pressable
                  key={city}
                  onPress={() => setCityFilter(city)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 99,
                    backgroundColor: isActive ? "#1C2B2A" : colors.card,
                    borderWidth: 1,
                    borderColor: isActive ? "#C9A84C" : colors.border,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  })}
                >
                  <Text style={{ color: isActive ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 13 }}>
                    {city}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ─── Results ─── */}
        <View style={{ paddingTop: 22, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingHorizontal: 4 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 18 }}>
              {serviceFilter === "all" ? "مقدمو الخدمة" : getCategoryById(serviceFilter)?.name ?? ""}
            </Text>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
              {activeCount > 0 ? (
                <Pressable onPress={() => setFilters(DEFAULT_FILTERS)}>
                  <Text style={{ color: colors.destructive, fontFamily: "Cairo_600SemiBold", fontSize: 12 }}>مسح الفلاتر</Text>
                </Pressable>
              ) : null}
              <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_500Medium", fontSize: 12 }}>
                {loadingProviders ? "جاري التحميل..." : `${filtered.length} نتيجة`}
              </Text>
            </View>
          </View>

          {loadingProviders ? (
            <View style={{ paddingVertical: 60, alignItems: "center" }}>
              <ActivityIndicator size="large" color="#C9A84C" />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", marginTop: 12, fontSize: 14 }}>
                جاري تحميل مقدمي الخدمة...
              </Text>
            </View>
          ) : filtered.length === 0 ? (
            <Card style={{ alignItems: "center", paddingVertical: 40 }}>
              <MaterialCommunityIcons name="account-search-outline" size={40} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_600SemiBold", marginTop: 10, textAlign: "center", fontSize: 14 }}>
                لا يوجد مقدمو خدمة مطابقون
              </Text>
              <Pressable onPress={() => { setFilters(DEFAULT_FILTERS); setSearch(""); setCityFilter("الكل"); setServiceFilter("all"); }} style={{ marginTop: 12 }}>
                <Text style={{ color: "#C9A84C", fontFamily: "Cairo_600SemiBold", fontSize: 13 }}>مسح الفلاتر</Text>
              </Pressable>
            </Card>
          ) : (
            <View style={{ gap: 12 }}>
              {filtered.map((p, i) => (
                <Animated.View key={p.id} entering={FadeInUp.delay(Math.min(i, 7) * 80).springify()}>
                  <ProviderCard provider={p} />
                </Animated.View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <FilterPanel
        visible={showFilterPanel}
        pending={pendingFilters}
        maxPriceLimit={maxPriceLimit}
        priceSteps={priceSteps}
        onChange={setPendingFilters}
        onApply={() => { setFilters(pendingFilters); setShowFilterPanel(false); }}
        onClose={() => setShowFilterPanel(false)}
        onReset={() => setPendingFilters(DEFAULT_FILTERS)}
      />
    </View>
  );
}

/* ─── Provider Card ──────────────────────────────────────────────────────── */
function ProviderCard({ provider }: { provider: Provider }) {
  const colors = useColors();
  const cat = getCategoryById(provider.serviceType);
  const minPrice = Math.min(...provider.services.map((s) => s.price));

  return (
    <Pressable
      onPress={() => router.push(`/provider/${provider.id}`)}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <Card style={{ padding: 14 }}>
        <View style={{ flexDirection: "row-reverse", gap: 14, alignItems: "flex-start" }}>
          <View style={{ position: "relative" }}>
            <Image
              source={provider.avatar}
              style={{ width: 72, height: 72, borderRadius: 18, backgroundColor: colors.surfaceMuted }}
              contentFit="cover"
            />
            <View style={{
              position: "absolute", bottom: -4, left: -4,
              width: 18, height: 18, borderRadius: 9,
              backgroundColor: provider.available ? colors.success : colors.mutedForeground,
              borderWidth: 3, borderColor: colors.card,
            }} />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 15, textAlign: "right" }} numberOfLines={1}>
                  {provider.name}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 12, textAlign: "right", marginTop: 2 }} numberOfLines={1}>
                  {provider.title}
                </Text>
                {provider.bio ? (
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 11, textAlign: "right", marginTop: 3, lineHeight: 16 }} numberOfLines={2}>
                    {provider.bio}
                  </Text>
                ) : null}
              </View>
              {cat ? (
                <View style={{ backgroundColor: "#1C2B2A12", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: "#C9A84C44" }}>
                  <Text style={{ color: "#1C2B2A", fontFamily: "Cairo_600SemiBold", fontSize: 10 }}>{cat.name}</Text>
                </View>
              ) : null}
            </View>

            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 8 }}>
              {provider.reviewsCount > 0 ? (
                <>
                  <Stars rating={provider.rating} size={13} />
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_500Medium", fontSize: 11 }}>
                    {provider.rating.toFixed(1)} ({provider.reviewsCount} تقييم)
                  </Text>
                </>
              ) : (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_500Medium", fontSize: 12 }}>
                  ⭐ مقدم جديد
                </Text>
              )}
            </View>

            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <Pill label={provider.responseTime} icon="clock-fast" tone={provider.available ? "success" : "default"} />
              <Pill label={`${provider.yearsExperience} سنة خبرة`} icon="medal" />
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 10, textAlign: "right" }}>ابتداءً من</Text>
            <Text style={{ color: "#C9A84C", fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right" }}>{minPrice} ج.م</Text>
          </View>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: "#1C2B2A", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 }}>
            <Text style={{ color: "#C9A84C", fontFamily: "Cairo_600SemiBold", fontSize: 13 }}>عرض الملف</Text>
            <MaterialCommunityIcons name="chevron-left" size={18} color="#C9A84C" />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

/* ─── Filter Panel ───────────────────────────────────────────────────────── */
function FilterPanel({ visible, pending, maxPriceLimit, priceSteps, onChange, onApply, onClose, onReset }: {
  visible: boolean; pending: Filters; maxPriceLimit: number; priceSteps: number[]; onChange: (f: Filters) => void;
  onApply: () => void; onClose: () => void; onReset: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const RATING_OPTIONS = [0, 3, 3.5, 4, 4.5, 5];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "#00000055" }} onPress={onClose} />
      <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom + 20, maxHeight: "88%" }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12, marginBottom: 4 }} />
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 }}>
          <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 18 }}>تصفية النتائج</Text>
          <Pressable onPress={onReset}>
            <Text style={{ color: colors.destructive, fontFamily: "Cairo_600SemiBold", fontSize: 13 }}>إعادة تعيين</Text>
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 24 }}>
          <View>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 15, textAlign: "right", marginBottom: 12 }}>الترتيب حسب</Text>
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
              {SORT_OPTIONS.map((opt) => {
                const isActive = pending.sortBy === opt.key;
                return (
                  <Pressable key={opt.key} onPress={() => onChange({ ...pending, sortBy: opt.key })}
                    style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: isActive ? "#C9A84C" : colors.border, backgroundColor: isActive ? "#C9A84C15" : colors.card }}>
                    <MaterialCommunityIcons name={opt.icon} size={14} color={isActive ? "#C9A84C" : colors.mutedForeground} />
                    <Text style={{ color: isActive ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_600SemiBold", fontSize: 13 }}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 15, textAlign: "right", marginBottom: 12 }}>
              الحد الأدنى للتقييم {pending.minRating > 0 ? `(${pending.minRating}+)` : "(الكل)"}
            </Text>
            <View style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" }}>
              {RATING_OPTIONS.map((r) => {
                const isActive = pending.minRating === r;
                return (
                  <Pressable key={r} onPress={() => onChange({ ...pending, minRating: r })}
                    style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: isActive ? "#C9A84C" : colors.border, backgroundColor: isActive ? "#C9A84C15" : colors.card }}>
                    <MaterialCommunityIcons name="star" size={13} color={isActive ? "#C9A84C" : colors.mutedForeground} />
                    <Text style={{ color: isActive ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 13 }}>{r === 0 ? "الكل" : `${r}+`}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View>
            <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 15, textAlign: "right", marginBottom: 12 }}>
              الحد الأقصى للسعر {pending.maxPrice < maxPriceLimit ? `(${pending.maxPrice} ج.م)` : "(الكل)"}
            </Text>
            <View style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" }}>
              {priceSteps.map((p) => {
                const isActive = pending.maxPrice === p;
                return (
                  <Pressable key={p} onPress={() => onChange({ ...pending, maxPrice: p })}
                    style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: isActive ? "#C9A84C" : colors.border, backgroundColor: isActive ? "#C9A84C15" : colors.card }}>
                    <Text style={{ color: isActive ? "#C9A84C" : colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 13 }}>{p === maxPriceLimit ? "الكل" : `${p} ج.م`}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Pressable onPress={() => onChange({ ...pending, onlyAvailable: !pending.onlyAvailable })}
            style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: pending.onlyAvailable ? colors.success : colors.border, backgroundColor: pending.onlyAvailable ? "#DCFCE7" : colors.card }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
              <MaterialCommunityIcons name="check-circle" size={22} color={pending.onlyAvailable ? "#16A34A" : colors.mutedForeground} />
              <View>
                <Text style={{ color: colors.foreground, fontFamily: "Cairo_700Bold", fontSize: 14, textAlign: "right" }}>متاح الآن فقط</Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 11, textAlign: "right" }}>إظهار المتاحين حالياً</Text>
              </View>
            </View>
            <View style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: pending.onlyAvailable ? "#16A34A" : colors.border, alignItems: pending.onlyAvailable ? "flex-end" : "flex-start", justifyContent: "center", padding: 2 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF" }} />
            </View>
          </Pressable>
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <PrimaryButton label="تطبيق الفلاتر" icon="check" onPress={onApply} />
        </View>
      </View>
    </Modal>
  );
}
