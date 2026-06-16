import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session } from "@supabase/supabase-js";
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
  paymentMethod: "cash" | "vodafone_cash" | "instapay";
  notes?: string;
  // للحجز بدون تسجيل
  guestName?: string;
  guestPhone?: string;
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
  // Auth
  session: Session | null;
  isLoggedIn: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

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
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<CustomerProfile>(DEFAULT_PROFILE);
  const [isHydrated, setIsHydrated] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // ─── Hydrate profile from AsyncStorage + Supabase Auth ──────────────────
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

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          // جيب بيانات المستخدم من جدول users
          const { data: userData } = await supabase
            .from("users")
            .select("*")
            .eq("id", newSession.user.id)
            .single();

          if (userData) {
            const merged: CustomerProfile = {
              name: userData.full_name ?? "",
              phone: userData.phone ?? "",
              address: userData.address ?? "",
              area: userData.area ?? "",
              city: userData.city ?? "القاهرة",
              notes: "",
              isGuest: false,
              userId: newSession.user.id,
            };
            setProfile(merged);
            await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
          }
        }
      }
    );

    return () => subscription.unsubscribe();
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

  // ─── Auth actions ─────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(DEFAULT_PROFILE);
    setBookings([]);
    await AsyncStorage.removeItem(PROFILE_KEY);
  };

  // ─── Profile actions ─────────────────────────────────────────────────────
  const updateProfile = async (next: Partial<CustomerProfile>) => {
    const merged = { ...profile, ...next };
    setProfile(merged);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(merged));

    // لو مسجل، احفظ في Supabase كمان
    if (session?.user?.id) {
      await supabase.from("users").upsert({
        id: session.user.id,
        full_name: merged.name,
        phone: merged.phone,
        address: merged.address,
        area: merged.area,
        city: merged.city,
      });
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(DEFAULT_PROFILE);
    setBookings([]);
    await AsyncStorage.removeItem(PROFILE_KEY);
  };

  // ─── Create booking ───────────────────────────────────────────────────────
  const createBooking = async (input: CreateBookingInput): Promise<Booking> => {
    const clientName = input.guestName || profile.name;
    const clientPhone = input.guestPhone || profile.phone;

    if (!clientName || !clientPhone) {
      throw new Error("يرجى إدخال اسمك ورقم هاتفك أولاً");
    }

    // احفظ البيانات في البروفايل لو لسه مش محفوظة
    if (input.guestName || input.guestPhone) {
      const merged = {
        ...profile,
        name: input.guestName || profile.name,
        phone: input.guestPhone || profile.phone,
      };
      setProfile(merged);
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
    }

    const bookingData = {
      client_name: clientName,
      client_phone: clientPhone,
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
      .eq("client_phone", clientPhone)
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
      session,
      isLoggedIn: !!session,
      signIn,
      signOut,
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
    [session, profile, isHydrated, providers, loadingProviders, bookings, loadingBookings]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
