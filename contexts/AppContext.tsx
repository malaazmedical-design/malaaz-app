import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

import { registerClientPushToken } from "@/lib/push";
import {
  supabase,
  DbBooking,
  DbCoverageArea,
  DbProviderService,
  DbSubService,
} from "@/lib/supabase";
import {
  Provider,
  mapDbProviderToProvider,
  serviceTypeToArabic,
  ServiceType,
  PaymentMethod,
} from "@/constants/data";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CustomerProfile = {
  name: string;
  phone: string;
  address: string;
  area: string;
  city: string;
  notes: string;
  isGuest: boolean;
  userId?: string;
  // بيانات إضافية اختيارية
  email?: string;
  whatsapp?: string;
  phone2?: string;
  avatarUri?: string;
  termsAccepted?: boolean;
};

export type Review = {
  rating: number;
  comment: string;
  createdAt: string;
};

export type ProviderReview = {
  clientName: string;
  rating: number;
  text: string | null;
};

export type Booking = DbBooking & {
  review?: Review;
  providerName?: string;
};

export type CreateBookingInput = {
  serviceType: string;
  serviceName: string;
  servicePrice?: number;
  providerId?: string;
  providerName?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  paymentMethod: PaymentMethod;
  notes?: string;
};

const PROFILE_KEY = "malaaz.profile.v1";
const BOOKINGS_KEY = "malaaz.bookings.v1";

// RLS بيمنع الزائر (anon) من قراءة الحجوزات من السيرفر، فبنحتفظ بنسخة محلية
// من الحجوزات اللي اتعملت من الجهاز ده لحد ما نضيف تسجيل دخول.
function makeLocalId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DEFAULT_PROFILE: CustomerProfile = {
  name: "",
  phone: "",
  address: "",
  area: "",
  city: "القاهرة",
  notes: "",
  isGuest: true,
};

// ─── Context ──────────────────────────────────────────────────────────────────

type AppContextValue = {
  // Profile
  profile: CustomerProfile;
  isHydrated: boolean;
  updateProfile: (next: Partial<CustomerProfile>) => Promise<void>;
  logout: () => Promise<void>;

  // Providers
  providers: Provider[];
  loadingProviders: boolean;
  refreshProviders: () => Promise<void>;

  // بيانات الخدمات والمناطق من قاعدة البيانات (زي الموقع)
  subServices: DbSubService[];
  coverageAreas: DbCoverageArea[];
  // آراء العملاء المعتمدة لكل مقدم (لعرضها في بروفايله زي الموقع)
  providerReviews: Record<string, ProviderReview[]>;

  // Bookings
  bookings: Booking[];
  loadingBookings: boolean;
  createBooking: (input: CreateBookingInput) => Promise<Booking>;
  cancelBooking: (id: string) => Promise<void>;
  addReview: (bookingId: string, providerId: string, review: Review) => Promise<void>;
  refreshBookings: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<CustomerProfile>(DEFAULT_PROFILE);
  const [isHydrated, setIsHydrated] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [subServices, setSubServices] = useState<DbSubService[]>([]);
  const [coverageAreas, setCoverageAreas] = useState<DbCoverageArea[]>([]);
  const [providerReviews, setProviderReviews] = useState<Record<string, ProviderReview[]>>({});
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // ─── Hydrate profile + local bookings from AsyncStorage ──────────────────
  useEffect(() => {
    (async () => {
      try {
        const [profileRaw, bookingsRaw] = await Promise.all([
          AsyncStorage.getItem(PROFILE_KEY),
          AsyncStorage.getItem(BOOKINGS_KEY),
        ]);
        if (profileRaw) setProfile(JSON.parse(profileRaw) as CustomerProfile);
        if (bookingsRaw) setBookings(JSON.parse(bookingsRaw) as Booking[]);
      } catch {
        // ignore
      } finally {
        setIsHydrated(true);
      }
    })();
  }, []);

  const persistBookings = async (next: Booking[]) => {
    setBookings(next);
    try {
      await AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  // ─── Load providers from Supabase ───────────────────────────────────────
  const refreshProviders = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const [provRes, reviewsRes, subsRes, areasRes, provSvcRes] = await Promise.all([
        supabase
          .from("providers")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        // التقييمات المعتمدة — بنحسب منها المتوسط والعدد ونعرض آراء العملاء (زي الموقع)
        supabase
          .from("reviews")
          .select("provider_id,client_name,rating,text,created_at")
          .eq("is_approved", true)
          .order("created_at", { ascending: false }),
        supabase.from("sub_services").select("*").eq("is_active", true).order("name"),
        supabase.from("coverage_areas").select("*").eq("is_active", true).order("name"),
        supabase.from("provider_services").select("*").eq("is_active", true),
      ]);

      if (provRes.error) throw provRes.error;

      // متوسط التقييم + العدد + آخر 5 آراء لكل مقدم
      const stats: Record<string, { sum: number; count: number }> = {};
      const reviewsMap: Record<string, ProviderReview[]> = {};
      for (const r of reviewsRes.data ?? []) {
        if (!r.provider_id) continue;
        (stats[r.provider_id] ??= { sum: 0, count: 0 });
        stats[r.provider_id].sum += r.rating ?? 5;
        stats[r.provider_id].count += 1;
        (reviewsMap[r.provider_id] ??= []);
        if (reviewsMap[r.provider_id].length < 5) {
          reviewsMap[r.provider_id].push({
            clientName: r.client_name || "عميل",
            rating: r.rating ?? 5,
            text: r.text ?? null,
          });
        }
      }
      setProviderReviews(reviewsMap);

      const subs = (subsRes.data ?? []) as DbSubService[];
      const subsById = new Map(subs.map((s) => [s.id, s]));
      setSubServices(subs);
      setCoverageAreas((areasRes.data ?? []) as DbCoverageArea[]);

      // الخدمات والأسعار الحقيقية اللي كل مقدم حددها من بوابته
      const servicesByProvider: Record<string, DbProviderService[]> = {};
      for (const ps of (provSvcRes.data ?? []) as DbProviderService[]) {
        (servicesByProvider[ps.provider_id] ??= []).push(ps);
      }

      const mapped = (provRes.data ?? []).map((db) => {
          const p = mapDbProviderToProvider(db);
          const own = servicesByProvider[p.id] ?? [];
          const consultant = db.grade === "استشاري";
          const realServices = own
            .map((ps) => {
              const sub = subsById.get(ps.sub_service_id);
              if (!sub) return null;
              const fallbackPrice =
                (consultant ? sub.price_min_consultant : sub.price_min_specialist) ??
                sub.price_min ?? 0;
              return {
                id: ps.id,
                name: sub.name,
                description: sub.service_name,
                price: ps.custom_price ?? fallbackPrice,
                durationLabel: sub.duration ?? "",
              };
            })
            .filter((s): s is NonNullable<typeof s> => s !== null);

          const st = stats[p.id];
          return {
            ...p,
            // التقييم الحقيقي = متوسط آراء العملاء المعتمدة (زي الموقع)
            rating: st ? st.sum / st.count : p.rating,
            reviewsCount: st?.count ?? 0,
            // لو المقدم محدد خدماته وأسعاره — نعرضها هي؛ وإلا الافتراضية
            services: realServices.length ? realServices : p.services,
          };
        });

      // الترتيب زي الموقع: الأعلى تقييماً ثم الأكثر مراجعات
      mapped.sort(
        (a, b) =>
          (b.reviewsCount ? b.rating : 0) - (a.reviewsCount ? a.rating : 0) ||
          b.reviewsCount - a.reviewsCount
      );
      setProviders(mapped);
    } catch (err) {
      console.error("Error loading providers:", err);
      setProviders([]);
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  useEffect(() => {
    refreshProviders();
  }, [refreshProviders]);

  // ─── Load bookings (by phone) ───────────────────────────────────────────
  // ملحوظة: RLS بيرجّع قائمة فاضية للزائر، فبندمج نتيجة السيرفر مع الكاش المحلي
  const refreshBookings = useCallback(async () => {
    if (!profile.phone) return;
    setLoadingBookings(true);
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("phone", profile.phone)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const remote: Booking[] = (data ?? []).map((b: DbBooking) => ({
        ...b,
        providerName:
          providers.find((p) => p.id === b.provider_id)?.name ?? undefined,
      }));

      setBookings((local) => {
        const remoteIds = new Set(remote.map((b) => b.id));
        const merged = [...remote, ...local.filter((b) => !remoteIds.has(b.id))];
        merged.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
        AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(merged)).catch(() => {});
        return merged;
      });
    } catch (err) {
      console.error("Error loading bookings:", err);
    } finally {
      setLoadingBookings(false);
    }
  }, [profile.phone, providers]);

  useEffect(() => {
    if (profile.phone) {
      refreshBookings();
      // تسجيل توكن الإشعارات — عشان توصله تحديثات حجوزاته push بدل الإيميل
      registerClientPushToken(profile.phone).catch(() => {});
    }
  }, [profile.phone]);

  // ─── Profile actions ─────────────────────────────────────────────────────
  const updateProfile = async (next: Partial<CustomerProfile>) => {
    const merged = { ...profile, ...next };
    setProfile(merged);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
  };

  const logout = async () => {
    setProfile(DEFAULT_PROFILE);
    setBookings([]);
    await AsyncStorage.multiRemove([PROFILE_KEY, BOOKINGS_KEY]);
  };

  // ─── Create booking ───────────────────────────────────────────────────────
  const createBooking = async (input: CreateBookingInput): Promise<Booking> => {
    if (!profile.name || !profile.phone) {
      throw new Error("يرجى إدخال بياناتك أولاً");
    }

    // بنولّد الـ id محلياً لأن RLS بيمنع قراءة الصف بعد الإدراج
    const id = makeLocalId();
    const appointmentTime =
      [input.scheduledDate, input.scheduledTime].filter(Boolean).join(" ") || null;

    // المنطقة: من الـ GPS لو اتحددت، وإلا أول جزء من العنوان
    const derivedArea =
      profile.area ||
      profile.address?.split(/[،,]/)[0]?.trim().slice(0, 40) ||
      profile.city ||
      null;

    const bookingData = {
      id,
      patient_name: profile.name,
      phone: profile.phone,
      patient_email: profile.email || null,
      address: profile.address || null,
      area: derivedArea,
      service_type: serviceTypeToArabic(input.serviceType as ServiceType),
      sub_option: input.serviceName,
      price: input.servicePrice ?? null,
      provider_id: input.providerId ?? null,
      status: "pending" as const,
      payment_method: input.paymentMethod,
      payment_status: "pending",
      notes: input.notes ?? null,
      appointment_time: appointmentTime,
    };

    const { error } = await supabase.from("bookings").insert(bookingData);

    if (error) throw error;

    const booking: Booking = {
      ...bookingData,
      provider_phone: null,
      client_id: null,
      created_at: new Date().toISOString(),
      providerName: input.providerName,
    };

    await persistBookings([booking, ...bookings]);
    return booking;
  };

  // ─── Cancel booking ───────────────────────────────────────────────────────
  const cancelBooking = async (id: string) => {
    // التحديث على السيرفر محتاج تسجيل دخول (RLS)؛ بنحدّث محلياً في كل الأحوال
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    await persistBookings(
      bookings.map((b) => (b.id === id ? { ...b, status: "cancelled" as const } : b))
    );
  };

  // ─── Add review ───────────────────────────────────────────────────────────
  const addReview = async (
    bookingId: string,
    providerId: string,
    review: Review
  ) => {
    const booking = bookings.find((b) => b.id === bookingId);

    // حفظ الريفيو في Supabase (بيظهر للعامة بعد موافقة الأدمن)
    await supabase.from("reviews").insert({
      provider_id: providerId || null,
      client_name: profile.name,
      service_type: booking?.service_type ?? null,
      rating: review.rating,
      text: review.comment || null,
    });

    // تحديث الـ booking محلياً
    await persistBookings(
      bookings.map((b) =>
        b.id === bookingId ? { ...b, status: "completed" as const, review } : b
      )
    );
  };

  // ─── Context value ────────────────────────────────────────────────────────
  const value = useMemo<AppContextValue>(
    () => ({
      profile,
      isHydrated,
      updateProfile,
      logout,
      providers,
      loadingProviders,
      refreshProviders,
      subServices,
      coverageAreas,
      providerReviews,
      bookings,
      loadingBookings,
      createBooking,
      cancelBooking,
      addReview,
      refreshBookings,
    }),
    [profile, isHydrated, providers, loadingProviders, subServices, coverageAreas, providerReviews, bookings, loadingBookings]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
