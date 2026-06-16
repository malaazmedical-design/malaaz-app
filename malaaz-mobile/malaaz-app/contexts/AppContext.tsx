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

import { supabase, DbBooking } from "@/lib/supabase";
import { Provider, mapDbProviderToProvider } from "@/constants/data";

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
};

export type Review = {
  rating: number;
  comment: string;
  createdAt: string;
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
  paymentMethod: "cash" | "vodafone_cash";
  notes?: string;
};

const PROFILE_KEY = "malaaz.profile.v1";

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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // ─── Hydrate profile from AsyncStorage ──────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PROFILE_KEY);
        if (raw) setProfile(JSON.parse(raw) as CustomerProfile);
      } catch {
        // ignore
      } finally {
        setIsHydrated(true);
      }
    })();
  }, []);

  // ─── Load providers from Supabase ───────────────────────────────────────
  const refreshProviders = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const { data, error } = await supabase
        .from("providers")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProviders((data ?? []).map(mapDbProviderToProvider));
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
  const refreshBookings = useCallback(async () => {
    if (!profile.phone) return;
    setLoadingBookings(true);
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("client_phone", profile.phone)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // إضافة اسم المزود لكل حجز
      const enriched: Booking[] = (data ?? []).map((b) => ({
        ...b,
        providerName:
          providers.find((p) => p.id === b.provider_id)?.name ?? undefined,
      }));
      setBookings(enriched);
    } catch (err) {
      console.error("Error loading bookings:", err);
    } finally {
      setLoadingBookings(false);
    }
  }, [profile.phone, providers]);

  useEffect(() => {
    if (profile.phone) refreshBookings();
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
    await AsyncStorage.removeItem(PROFILE_KEY);
  };

  // ─── Create booking ───────────────────────────────────────────────────────
  const createBooking = async (input: CreateBookingInput): Promise<Booking> => {
    if (!profile.name || !profile.phone) {
      throw new Error("يرجى إدخال بياناتك أولاً");
    }

    const bookingData = {
      client_name: profile.name,
      client_phone: profile.phone,
      client_address: profile.address,
      area: profile.area,
      city: profile.city,
      service_type: input.serviceType,
      service_name: input.serviceName,
      service_price: input.servicePrice ?? null,
      provider_id: input.providerId ?? null,
      status: "pending" as const,
      payment_method: input.paymentMethod,
      notes: input.notes ?? null,
      scheduled_date: input.scheduledDate ?? null,
      scheduled_time: input.scheduledTime ?? null,
    };

    const { data, error } = await supabase
      .from("bookings")
      .insert(bookingData);

    if (error) throw error;

    // نجيب الحجز اللي اتعمل عشان نرجع الـ id
    const { data: newBooking } = await supabase
      .from("bookings")
      .select("*")
      .eq("client_phone", profile.phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const booking: Booking = {
      ...(newBooking ?? { ...bookingData, id: Date.now().toString(), created_at: new Date().toISOString() }),
      providerName: input.providerName,
    };

    setBookings((prev) => [booking, ...prev]);
    return booking;
  };

  // ─── Cancel booking ───────────────────────────────────────────────────────
  const cancelBooking = async (id: string) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) throw error;
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "cancelled" as const } : b))
    );
  };

  // ─── Add review ───────────────────────────────────────────────────────────
  const addReview = async (
    bookingId: string,
    providerId: string,
    review: Review
  ) => {
    // حفظ الريفيو في Supabase
    await supabase.from("reviews").insert({
      booking_id: bookingId,
      provider_id: providerId,
      client_name: profile.name,
      rating: review.rating,
      comment: review.comment,
    });

    // تحديث الـ booking محلياً
    setBookings((prev) =>
      prev.map((b) =>
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
      bookings,
      loadingBookings,
      createBooking,
      cancelBooking,
      addReview,
      refreshBookings,
    }),
    [profile, isHydrated, providers, loadingProviders, bookings, loadingBookings]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
