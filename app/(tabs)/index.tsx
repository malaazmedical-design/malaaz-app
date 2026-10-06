import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Provider,
  SERVICE_CATEGORIES,
  ServiceType,
  normalizeArabic,
  providerCities,
} from "@/constants/data";
import { TJ, useMalaz } from "@/constants/malazTheme";
import { useApp } from "@/contexts/AppContext";
import { DbSubService } from "@/lib/supabase";

type SortKey = "rating" | "price_asc" | "price_desc" | "experience";
type Filters = {
  minRating: number;
  maxPrice: number;
  onlyAvailable: boolean;
  sortBy: SortKey;
};
const DEFAULT_FILTERS: Filters = {
  minRating: 0,
  maxPrice: Infinity,
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

// Home provider carousel
const CARD_W = 168;
const CARD_GAP = 12;
const CARD_STEP = CARD_W + CARD_GAP;
const TOP_N = 10;
const PAGE = 10;

const LOGO_LIGHT = require("../../assets/images/malaz/logo-light.png");
const LOGO_DARK = require("../../assets/images/malaz/logo-dark.png");

function countActiveFilters(f: Filters, maxPriceLimit: number) {
  let n = 0;
  if (f.minRating > 0) n++;
  if (f.maxPrice < maxPriceLimit) n++;
  if (f.onlyAvailable) n++;
  if (f.sortBy !== "rating") n++;
  return n;
}

const minPriceOf = (p: Provider) =>
  p.services.length ? Math.min(...p.services.map((s) => s.price)) : 0;

type CarouselItem = Provider | { id: "__all__" };

export default function HomeScreen() {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const { profile, providers, loadingProviders, coverageAreas, subServices } = useApp();
  const [serviceFilter, setServiceFilter] = useState<ServiceType | "all">("all");
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);
  const [subServiceFilter, setSubServiceFilter] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState("الكل");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [viewAll, setViewAll] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [rowIdx, setRowIdx] = useState(0);
  const rowRef = useRef<FlatList<CarouselItem>>(null);
  const rowIdxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  // قائمة المدن ديناميكياً من coverage_areas
  const availableCities = useMemo(() => {
    const seen = new Set<string>();
    for (const a of coverageAreas) {
      if (a.city) seen.add(a.city);
    }
    return Array.from(seen).sort();
  }, [coverageAreas]);

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

  // Sub-filters بناءً على نوع الخدمة المختار
  const doctorGrades = useMemo(() =>
    subServices.filter((s) => s.service_name === "كشف منزلي" && s.group_name === "grade"),
    [subServices]);
  const doctorSpecialties = useMemo(() =>
    subServices.filter((s) => s.service_name === "كشف منزلي" && s.group_name === "specialty"),
    [subServices]);
  const nurseSubServices = useMemo(() =>
    subServices.filter((s) => s.service_name === "تمريض منزلي" && s.group_name !== "grade"),
    [subServices]);
  const xraySubServices = useMemo(() =>
    subServices.filter((s) => s.service_name === "أشعة منزلية" && s.group_name !== "grade"),
    [subServices]);

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
        if (match && match.city) {
          // ما نغيّرش الفلتر لو العميل غيّره يدوي وهو منتظر نتيجة تحديد الموقع
          setCityFilter((prev) => (prev === "الكل" ? match.city : prev));
        }
      } catch {
        // تعذّر تحديد الموقع — القائمة تفضل بدون فلتر مدينة (السلوك الافتراضي)
      }
    })();
  }, [loadingProviders, coverageAreas]);

  const runFilter = useCallback((filters: Filters): Provider[] => {
    let list: Provider[] = providers;
    if (serviceFilter !== "all") list = list.filter((p) => p.serviceType === serviceFilter);
    if (gradeFilter) list = list.filter((p) => p.title.includes(gradeFilter));
    if (subServiceFilter) list = list.filter((p) =>
      p.title.includes(subServiceFilter) ||
      p.services.some((s) => s.name === subServiceFilter)
    );
    if (cityFilter !== "الكل") {
      // مطابقة ذكية: مناطق المقدم بتتترجم لمدينتها مهما كانت طريقة كتابتها،
      // واللي مدينته مش معروفة بيظهر في الحالتين بدل ما يختفي
      list = list.filter((p) => {
        const cities = providerCities(p.areas.length ? p.areas : [p.city], coverageAreas);
        return cities.size === 0 || cities.has(cityFilter);
      });
    }
    const nq = normalizeArabic(search.trim());
    if (nq) {
      list = list.filter((p) =>
        normalizeArabic(p.name).includes(nq) ||
        normalizeArabic(p.title).includes(nq) ||
        normalizeArabic(p.bio).includes(nq) ||
        p.areas.some((a) => normalizeArabic(a).includes(nq))
      );
    }
    if (filters.minRating > 0) list = list.filter((p) => p.rating >= filters.minRating);
    if (filters.maxPrice < maxPriceLimit)
      list = list.filter((p) =>
        (p.services.length ? Math.min(...p.services.map((s) => s.price)) : 0) <= filters.maxPrice
      );
    if (filters.onlyAvailable) list = list.filter((p) => p.available);

    const relevance = (p: Provider): number => {
      if (!nq) return 0;
      const nn = normalizeArabic(p.name);
      if (nn === nq) return 4;
      if (nn.includes(nq)) return 3;
      if (normalizeArabic(p.title).includes(nq)) return 2;
      return 1;
    };

    return [...list].sort((a, b) => {
      if (nq && filters.sortBy === "rating") {
        const diff = relevance(b) - relevance(a);
        if (diff !== 0) return diff;
        return b.rating - a.rating;
      }
      switch (filters.sortBy) {
        case "rating":     return b.rating - a.rating;
        case "price_asc":  return (a.services.length ? Math.min(...a.services.map((s) => s.price)) : 0) - (b.services.length ? Math.min(...b.services.map((s) => s.price)) : 0);
        case "price_desc": return (b.services.length ? Math.min(...b.services.map((s) => s.price)) : 0) - (a.services.length ? Math.min(...a.services.map((s) => s.price)) : 0);
        case "experience": return b.yearsExperience - a.yearsExperience;
      }
    });
  }, [serviceFilter, gradeFilter, subServiceFilter, cityFilter, search, providers, maxPriceLimit, coverageAreas]);
  const filtered = useMemo(() => runFilter(filters), [runFilter, filters]);
  // ─── Carousel (top 10) ───
  const topCount = Math.min(filtered.length, TOP_N);
  const carouselData: CarouselItem[] = useMemo(
    () => (filtered.length > TOP_N ? [...filtered.slice(0, TOP_N), { id: "__all__" as const }] : filtered),
    [filtered],
  );

  useEffect(() => {
    setRowIdx(0);
    setShown(PAGE);
    rowRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [filtered]);

  useEffect(() => {
    if (!viewAll) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setViewAll(false);
      return true;
    });
    return () => sub.remove();
  }, [viewAll]);

  useEffect(() => () => { if (rowIdxTimer.current) clearTimeout(rowIdxTimer.current); }, []);

  const onRowScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    if (rowIdxTimer.current) clearTimeout(rowIdxTimer.current);
    rowIdxTimer.current = setTimeout(() => {
      setRowIdx(Math.max(0, Math.min(topCount - 1, Math.round(x / CARD_STEP))));
    }, 120);
  };

  const scrollRow = (dir: 1 | -1) => {
    const next = Math.max(0, Math.min(carouselData.length - 1, rowIdx + dir));
    rowRef.current?.scrollToOffset({ offset: next * CARD_STEP, animated: true });
    setRowIdx(Math.min(next, topCount - 1));
  };

  const openProvider = useCallback((id: string) => router.push(`/provider/${id}`), []);
  const openFilters = () => { setPendingFilters(filters); setShowFilterPanel(true); };

  const resetAll = () => {
    setFilters(DEFAULT_FILTERS); setSearch(""); setCityFilter("الكل");
    setServiceFilter("all"); setGradeFilter(null); setSubServiceFilter(null);
  };

  const showCities = serviceFilter !== "all" || cityFilter !== "الكل";
  const hasSelection = serviceFilter !== "all" || !!gradeFilter || !!subServiceFilter || search.trim().length > 0 || activeCount > 0;

  const Section = ({ title }: { title: string }) => (
    <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15, textAlign: "right", paddingHorizontal: 20, marginBottom: 10 }}>
      {title}
    </Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Header ─── */}
        <View
          style={{
            backgroundColor: t.hdr,
            borderBottomLeftRadius: 36,
            borderBottomRightRadius: 36,
            paddingTop: insets.top + 20 + webTopInset,
            paddingHorizontal: 20,
            paddingBottom: 22,
          }}
        >
          <View style={{ height: 52, alignItems: "center", justifyContent: "center" }}>
            <Image source={t.isDark ? LOGO_DARK : LOGO_LIGHT} style={{ width: 115, height: 46 }} contentFit="contain" />
            <Pressable
              onPress={() => router.push("/profile")}
              accessibilityLabel="حسابي"
              style={{ position: "absolute", left: 0, width: 48, height: 48, borderRadius: 24, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}
            >
              <MaterialCommunityIcons name="account-outline" size={22} color={t.gold} />
            </Pressable>
          </View>

          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/quick-request");
            }}
            style={({ pressed }) => ({
              marginTop: 18, backgroundColor: t.gold, borderRadius: 20, padding: 16,
              flexDirection: "row-reverse", alignItems: "center", gap: 14,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: "rgba(255,255,255,.25)", alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name="lightning-bolt" size={28} color={t.onGold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 18, textAlign: "right" }}>طلب سريع</Text>
              <Text style={{ color: t.onGoldSub, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginTop: 2 }}>
                اطلب الخدمة وإحنا نختارلك أفضل مزود
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-left" size={24} color={t.onGold} />
          </Pressable>

          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, marginTop: 16 }}>
            <View style={{ flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 16, paddingHorizontal: 14, height: 48 }}>
              <MaterialCommunityIcons name="magnify" size={20} color={t.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="ابحث عن طبيب أو ممرض..."
                placeholderTextColor={t.muted}
                style={{ flex: 1, fontFamily: TJ.medium, fontSize: 14, color: t.text, textAlign: "right" }}
              />
              {search.length > 0 ? (
                <Pressable onPress={() => setSearch("")} accessibilityLabel="مسح البحث">
                  <MaterialCommunityIcons name="close-circle" size={18} color={t.muted} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={openFilters}
              accessibilityLabel="تصفية"
              style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: activeCount > 0 ? t.gold : t.btn, alignItems: "center", justifyContent: "center" }}
            >
              <MaterialCommunityIcons name="tune-variant" size={22} color={activeCount > 0 ? t.onGold : t.text} />
              {activeCount > 0 ? (
                <View style={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: t.destructive, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: t.hdr }}>
                  <Text style={{ color: "#fff", fontFamily: TJ.bold, fontSize: 10 }}>{activeCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        {/* ─── Service cards ─── */}
        <View style={{ flexDirection: "row-reverse", paddingHorizontal: 16, gap: 10, paddingTop: 20 }}>
          {SERVICE_CATEGORIES.map((cat) => {
            const isActive = serviceFilter === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => {
                  setServiceFilter(isActive ? "all" : (cat.id as ServiceType));
                  setGradeFilter(null);
                  setSubServiceFilter(null);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => ({
                  flex: 1, padding: 10, paddingTop: 12, borderRadius: 22, borderWidth: 1.5,
                  alignItems: "flex-end", gap: 12,
                  backgroundColor: isActive ? t.selected : t.card,
                  borderColor: isActive ? t.gold : t.border,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.ic, alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons
                    name={cat.icon as React.ComponentProps<typeof MaterialCommunityIcons>["name"]}
                    size={22}
                    color={t.isDark ? t.text : "#1e2d31"}
                  />
                </View>
                <Text numberOfLines={1} style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 13.5, textAlign: "right", alignSelf: "stretch" }}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ─── Ask a doctor ─── */}
        {!hasSelection && (
        <Pressable
          onPress={() => router.push("/ask-doctor")}
          style={({ pressed }) => ({
            marginHorizontal: 16, marginTop: 16, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.gold,
            borderRadius: 20, padding: 14, flexDirection: "row-reverse", alignItems: "center", gap: 14,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: t.ic, alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name="help" size={26} color={t.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 17, textAlign: "right" }}>إسأل طبيب</Text>
            <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13, textAlign: "right", marginTop: 2 }}>اكتب سؤالك أو وصف حالتك</Text>
          </View>
          <MaterialCommunityIcons name="chevron-left" size={24} color={t.gold} />
        </Pressable>
        )}

        {/* ─── Sub-filters (visible once a service is picked) ─── */}
        {serviceFilter === "doctor" && doctorGrades.length > 0 && (
          <View style={{ paddingTop: 18 }}>
            <Section title="الدرجة" />
            <PillRow items={doctorGrades} selected={gradeFilter} onSelect={(n) => setGradeFilter(gradeFilter === n ? null : n)} />
          </View>
        )}
        {serviceFilter === "doctor" && doctorSpecialties.length > 0 && (
          <View style={{ paddingTop: 18 }}>
            <Section title="التخصص" />
            <PillRow items={doctorSpecialties} selected={subServiceFilter} onSelect={(n) => setSubServiceFilter(subServiceFilter === n ? null : n)} />
          </View>
        )}
        {serviceFilter === "nurse" && nurseSubServices.length > 0 && (
          <View style={{ paddingTop: 18 }}>
            <Section title="نوع الخدمة" />
            <PillRow items={nurseSubServices} selected={subServiceFilter} onSelect={(n) => setSubServiceFilter(subServiceFilter === n ? null : n)} />
          </View>
        )}
        {serviceFilter === "xray" && xraySubServices.length > 0 && (
          <View style={{ paddingTop: 18 }}>
            <Section title="نوع الخدمة" />
            <PillRow items={xraySubServices} selected={subServiceFilter} onSelect={(n) => setSubServiceFilter(subServiceFilter === n ? null : n)} />
          </View>
        )}
        {showCities && (
          <View style={{ paddingTop: 18 }}>
            <Section title="المدينة" />
            <PillRow
              items={["الكل", ...availableCities].map((c) => ({ id: c, name: c })) as DbSubService[]}
              selected={cityFilter}
              onSelect={(c) => setCityFilter(c)}
            />
          </View>
        )}

        {/* ─── Providers carousel ─── */}
        <View style={{ paddingTop: 24 }}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 20, marginBottom: 12, gap: 10 }}>
            <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 20, textAlign: "right" }}>مقدمو الخدمة</Text>
            <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13, flex: 1, textAlign: "right" }}>
              {loadingProviders ? "جاري التحميل..." : `${filtered.length} نتيجة`}
            </Text>
            {filtered.length > 1 ? (
              <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                <Pressable onPress={() => scrollRow(-1)} accessibilityLabel="السابق" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={t.text} />
                </Pressable>
                <Pressable onPress={() => scrollRow(1)} accessibilityLabel="التالي" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name="chevron-left" size={20} color={t.text} />
                </Pressable>
              </View>
            ) : null}
          </View>

          {loadingProviders ? (
            <View style={{ paddingVertical: 60, alignItems: "center" }}>
              <ActivityIndicator size="large" color={t.gold} />
              <Text style={{ color: t.muted, fontFamily: TJ.medium, marginTop: 12, fontSize: 14 }}>جاري تحميل مقدمي الخدمة...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <MaterialCommunityIcons name="account-search-outline" size={40} color={t.muted} />
              <Text style={{ color: t.muted, fontFamily: TJ.bold, marginTop: 10, fontSize: 15 }}>لا توجد نتائج</Text>
              <Pressable onPress={resetAll} style={{ marginTop: 12 }}>
                <Text style={{ color: t.gold, fontFamily: TJ.bold, fontSize: 14 }}>مسح الفلاتر</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <FlatList
                ref={rowRef}
                data={carouselData}
                horizontal
                inverted
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_STEP}
                snapToAlignment="start"
                decelerationRate="fast"
                onScroll={onRowScroll}
                scrollEventThrottle={32}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
                renderItem={({ item }) =>
                  item.id === "__all__" ? (
                    <Pressable
                      onPress={() => setViewAll(true)}
                      style={{ width: CARD_W, minHeight: 215, borderRadius: 22, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.gold, alignItems: "center", justifyContent: "center", gap: 14 }}
                    >
                      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: t.gold, alignItems: "center", justifyContent: "center" }}>
                        <MaterialCommunityIcons name="chevron-left" size={30} color={t.onGold} />
                      </View>
                      <Text style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 17 }}>عرض الكل ({filtered.length})</Text>
                    </Pressable>
                  ) : (
                    <CarouselCard provider={item as Provider} onPress={openProvider} />
                  )
                }
              />
              <Text style={{ color: t.muted, fontFamily: TJ.bold, fontSize: 13, textAlign: "center", marginTop: 14 }}>
                {rowIdx + 1} / {topCount}
              </Text>
            </>
          )}
        </View>
      </ScrollView>

      {/* ─── View all ─── */}
      {viewAll && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.bg, zIndex: 20 }}>
          <View style={{ paddingTop: insets.top + 16 + webTopInset, paddingHorizontal: 16, paddingBottom: 12 }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
              <Pressable onPress={() => setViewAll(false)} accessibilityLabel="رجوع" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.btn, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="arrow-right" size={22} color={t.text} />
              </Pressable>
              <Text style={{ flex: 1, color: t.text, fontFamily: TJ.heavy, fontSize: 24, textAlign: "right" }}>مقدمو الخدمة</Text>
              <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 13 }}>{filtered.length} نتيجة</Text>
            </View>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 16, paddingHorizontal: 14, height: 46, marginTop: 14 }}>
              <MaterialCommunityIcons name="magnify" size={20} color={t.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="ابحث عن طبيب أو ممرض..."
                placeholderTextColor={t.muted}
                style={{ flex: 1, fontFamily: TJ.medium, fontSize: 14, color: t.text, textAlign: "right" }}
              />
            </View>
            <Pressable
              onPress={openFilters}
              style={{ marginTop: 10, height: 44, borderRadius: 14, backgroundColor: t.btn, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Text style={{ color: t.text, fontFamily: TJ.bold, fontSize: 15 }}>
                التصفية{activeCount > 0 ? ` (${activeCount})` : ""}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color={t.gold} />
            </Pressable>
          </View>
          <FlatList
            data={filtered.slice(0, shown)}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 110, gap: 12 }}
            onEndReachedThreshold={0.3}
            onEndReached={() => setShown((s) => (s < filtered.length ? s + PAGE : s))}
            ListEmptyComponent={
              <Text style={{ color: t.muted, fontFamily: TJ.bold, textAlign: "center", marginTop: 40 }}>لا توجد نتائج</Text>
            }
            ListFooterComponent={
              shown < filtered.length ? (
                <Text style={{ color: t.muted, fontFamily: TJ.medium, textAlign: "center", paddingVertical: 12 }}>جاري تحميل المزيد...</Text>
              ) : null
            }
            renderItem={({ item }) => <ProviderRow provider={item} onPress={openProvider} />}
          />
        </View>
      )}

      <FilterPanel
        visible={showFilterPanel}
        pending={pendingFilters}
        maxPriceLimit={maxPriceLimit}
        priceSteps={priceSteps}
        resultCount={runFilter(pendingFilters).length}
        onChange={setPendingFilters}
        onApply={() => { setFilters(pendingFilters); setShowFilterPanel(false); }}
        onClose={() => setShowFilterPanel(false)}
        onReset={() => setPendingFilters(DEFAULT_FILTERS)}
      />
    </View>
  );
}

/* ─── Pill row (single-select chips) ─────────────────────────────────────── */
function PillRow({ items, selected, onSelect }: {
  items: DbSubService[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  const t = useMalaz();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, flexDirection: "row-reverse" }}>
      {items.map((item) => {
        const isActive = selected === item.name;
        return (
          <Pressable
            key={item.id}
            onPress={() => onSelect(item.name)}
            style={{
              paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, borderWidth: 1.5,
              backgroundColor: isActive ? t.goldTint : t.card,
              borderColor: isActive ? t.gold : t.border,
            }}
          >
            <Text style={{ color: isActive ? t.gold : t.text, fontFamily: TJ.bold, fontSize: 14.5 }}>{item.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ─── Carousel card ──────────────────────────────────────────────────────── */
const CarouselCard = React.memo(function CarouselCard({ provider, onPress }: { provider: Provider; onPress: (id: string) => void }) {
  const t = useMalaz();
  return (
    <Pressable
      onPress={() => onPress(provider.id)}
      style={({ pressed }) => ({
        width: CARD_W, padding: 8, borderRadius: 22, backgroundColor: t.card, borderWidth: 1, borderColor: t.border,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ height: 128, borderRadius: 16, overflow: "hidden", backgroundColor: t.ic }}>
        <Image source={provider.avatar} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        <View style={{ position: "absolute", top: 8, right: 8, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: t.card, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 12 }}>{provider.rating.toFixed(1)}</Text>
          <MaterialCommunityIcons name="star" size={12} color={t.gold} />
        </View>
        <View style={{ position: "absolute", bottom: 8, left: 8, width: 14, height: 14, borderRadius: 7, backgroundColor: provider.available ? t.online : t.offline, borderWidth: 2, borderColor: t.card }} />
      </View>
      <Text numberOfLines={1} style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15, textAlign: "right", marginTop: 10 }}>{provider.name}</Text>
      <Text numberOfLines={1} style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginTop: 2 }}>{provider.title}</Text>
      {minPriceOf(provider) > 0 ? (
        <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right", marginTop: 6 }}>
          من <Text style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 15 }}>{minPriceOf(provider)}</Text> ج.م
        </Text>
      ) : null}
    </Pressable>
  );
});

/* ─── View-all row ───────────────────────────────────────────────────────── */
const ProviderRow = React.memo(function ProviderRow({ provider, onPress }: { provider: Provider; onPress: (id: string) => void }) {
  const { coverageAreas } = useApp();
  const govName = [...providerCities(provider.areas.length ? provider.areas : [provider.city], coverageAreas)][0] ?? provider.city;
  const t = useMalaz();
  return (
    <Pressable
      onPress={() => onPress(provider.id)}
      style={({ pressed }) => ({
        flexDirection: "row-reverse", alignItems: "center", gap: 12, padding: 12, borderRadius: 20,
        backgroundColor: t.card, borderWidth: 1, borderColor: t.border, transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View>
        <Image source={provider.avatar} style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: t.ic }} contentFit="cover" />
        <View style={{ position: "absolute", bottom: -3, left: -3, width: 14, height: 14, borderRadius: 7, backgroundColor: provider.available ? t.online : t.offline, borderWidth: 2, borderColor: t.card }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15, textAlign: "right" }}>{provider.name}</Text>
        <Text numberOfLines={1} style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12, textAlign: "right", marginTop: 2 }}>
          {provider.title} · {govName}
        </Text>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, marginTop: 4 }}>
          <MaterialCommunityIcons name="star" size={13} color={t.gold} />
          <Text style={{ color: t.text, fontFamily: TJ.bold, fontSize: 12.5 }}>{provider.rating.toFixed(1)}</Text>
          {provider.reviewsCount > 0 ? <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12 }}>({provider.reviewsCount})</Text> : null}
        </View>
      </View>
      {minPriceOf(provider) > 0 ? (
      <View style={{ alignItems: "center" }}>
        <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 11 }}>من</Text>
        <Text style={{ color: t.gold, fontFamily: TJ.heavy, fontSize: 17 }}>{minPriceOf(provider)}</Text>
        <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 11 }}>ج.م</Text>
      </View>
      ) : null}
    </Pressable>
  );
});

/* ─── Filter sheet ───────────────────────────────────────────────────────── */
function FilterPanel({ visible, pending, maxPriceLimit, priceSteps, resultCount, onChange, onApply, onClose, onReset }: {
  visible: boolean; pending: Filters; maxPriceLimit: number; priceSteps: number[]; resultCount: number;
  onChange: (f: Filters) => void; onApply: () => void; onClose: () => void; onReset: () => void;
}) {
  const t = useMalaz();
  const insets = useSafeAreaInsets();
  const RATING_OPTIONS = [0, 3, 3.5, 4, 4.5, 5];

  const chip = (active: boolean) => ({
    flexDirection: "row-reverse" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 5,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5,
    borderColor: active ? t.gold : t.border, backgroundColor: active ? t.goldTint : t.card,
  });
  const chipText = (active: boolean) => ({ color: active ? t.gold : t.text, fontFamily: TJ.bold, fontSize: 14 });
  const heading = { color: t.text, fontFamily: TJ.heavy, fontSize: 16, textAlign: "right" as const, marginBottom: 12 };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,.45)" }} onPress={onClose} />
      <View style={{ backgroundColor: t.hdr, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: insets.bottom + 20, maxHeight: "90%" }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 22, paddingBottom: 14 }}>
          <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 22 }}>تصفية النتائج</Text>
          <Pressable onPress={onReset}>
            <Text style={{ color: t.destructive, fontFamily: TJ.bold, fontSize: 14 }}>إعادة تعيين</Text>
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 22 }}>
          <View>
            <Text style={heading}>الترتيب حسب</Text>
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 }}>
              {SORT_OPTIONS.map((opt) => {
                const active = pending.sortBy === opt.key;
                return (
                  <Pressable key={opt.key} onPress={() => onChange({ ...pending, sortBy: opt.key })} style={[chip(active), { width: "48%" }]}>
                    <MaterialCommunityIcons name={opt.icon} size={14} color={active ? t.gold : t.muted} />
                    <Text style={chipText(active)}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View>
            <Text style={heading}>الحد الأدنى للتقييم</Text>
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 }}>
              {RATING_OPTIONS.map((r) => {
                const active = pending.minRating === r;
                return (
                  <Pressable key={r} onPress={() => onChange({ ...pending, minRating: r })} style={chip(active)}>
                    <MaterialCommunityIcons name="star" size={13} color={active ? t.gold : t.muted} />
                    <Text style={chipText(active)}>{r === 0 ? "الكل" : `${r}+`}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View>
            <Text style={heading}>الحد الأقصى للسعر</Text>
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 }}>
              {priceSteps.map((p) => {
                const active = pending.maxPrice === p || (p === maxPriceLimit && pending.maxPrice >= maxPriceLimit);
                return (
                  <Pressable key={p} onPress={() => onChange({ ...pending, maxPrice: p })} style={chip(active)}>
                    <Text style={chipText(active)}>{p === maxPriceLimit ? "الكل" : `${p} ج.م`}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Pressable
            onPress={() => onChange({ ...pending, onlyAvailable: !pending.onlyAvailable })}
            style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 18, borderWidth: 1, borderColor: t.border, backgroundColor: t.card }}
          >
            <View>
              <Text style={{ color: t.text, fontFamily: TJ.heavy, fontSize: 15, textAlign: "right" }}>متاح الآن فقط</Text>
              <Text style={{ color: t.muted, fontFamily: TJ.medium, fontSize: 12.5, textAlign: "right" }}>إظهار المتاحين حاليًا</Text>
            </View>
            <View style={{ width: 52, height: 30, borderRadius: 15, backgroundColor: pending.onlyAvailable ? t.gold : t.btn, justifyContent: "center", paddingHorizontal: 3, alignItems: pending.onlyAvailable ? "flex-end" : "flex-start" }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff" }} />
            </View>
          </Pressable>
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
          <Pressable onPress={onApply} style={{ height: 54, borderRadius: 16, backgroundColor: t.gold, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: t.onGold, fontFamily: TJ.heavy, fontSize: 17 }}>تطبيق الفلاتر ({resultCount})</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
