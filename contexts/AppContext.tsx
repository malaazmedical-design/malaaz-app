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
  DbClient,
  DbClientAddress,
  DbCoverageArea,
  DbFamilyMember,
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
  // الحجز لفرد من العائلة — الاسم بيحل محل اسم صاحب الحساب
  patientName?: string;
  // رقم الموبايل من الفورم مباشرة (يتجاوز تأخير تحديث profile)
  patientPhone?: string;
  // البريد والعنوان والمنطقة من الفورم مباشرة
  patientEmail?: string;
  patientAddress?: string;
  patientArea?: string;
};

export type ClientRegisterInput = {
  name: string;
  phone: string;
  email: string;
  password: string;
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

  // ─── حساب العميل (زي client.html) ─────────────────────────────────────
  client: DbClient | null;
  clientLogin: (email: string, password: string) => Promise<void>;
  clientRegister: (input: ClientRegisterInput) => Promise<void>;
  clientLogout: () => Promise<void>;
  clientResetPassword: (email: string) => Promise<void>;

  // العناوين المحفوظة
  addresses: DbClientAddress[];
  addAddress: (address: string, area: string, isDefault: boolean) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;

  // أفراد العائلة
  familyMembers: DbFamilyMember[];
  addFamilyMember: (m: { name: string; relation?: string; birthYear?: number; notes?: string }) => Promise<void>;
  deleteFamilyMember: (id: string) => Promise<void>;
  updateFamilyMember: (id: string, m: { name: string; relation?: string; birthYear?: number; notes?: string }) => Promise<void>;
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
  const [client, setClient] = useState<DbClient | null>(null);
  const [addresses, setAddresses] = useState<DbClientAddress[]>([]);
  const [familyMembers, setFamilyMembers] = useState<DbFamilyMember[]>([]);

  // الكاش المحلي ممكن يحتوي حجوزات اتعملت من نفس الجهاز بهويات مختلفة (أرقام مختلفة
  // جُرّبت على نفس التليفون)؛ بنعرض بس اللي يطابق الهوية الحالية (رقم الهاتف أو الحساب المسجّل)
  const visibleBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          (!!client && b.client_id === client.id) ||
          (!!profile.phone && b.phone === profile.phone)
      ),
    [bookings, profile.phone, client]
  );

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

  // ─── حساب العميل: استرجاع الجلسة المحفوظة ────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const { data } = await supabase
          .from("clients")
          .select("*")
          .eq("auth_id", session.user.id)
          .single();
        if (data) await onClientReady(data as DbClient);
      } catch {
        // مفيش جلسة عميل — وضع الزائر عادي
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // بعد تسجيل الدخول/الاسترجاع: مزامنة البروفايل + ربط الحجوزات القديمة + تحميل بياناته
  const onClientReady = async (c: DbClient) => {
    setClient(c);
    setProfile((prev) => {
      const merged: CustomerProfile = {
        ...prev,
        name: c.name ?? prev.name,
        phone: c.phone ?? prev.phone,
        email: c.email ?? prev.email,
        whatsapp: c.whatsapp ?? prev.whatsapp,
        phone2: c.phone2 ?? prev.phone2,
        isGuest: false,
      };
      AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(merged)).catch(() => {});
      return merged;
    });
    // تسجيل توكن الإشعارات مباشرة بعد الدخول بدل الانتظار على تغيّر profile.phone
    if (c.phone) registerClientPushToken(c.phone).catch(() => {});
    // ربط أي حجوزات قديمة بنفس رقم الموبايل بالحساب (RPC آمنة على السيرفر)
    supabase.rpc("link_my_bookings").then(() => {}, () => {});
    loadClientData(c.id);
  };

  const loadClientData = async (clientId: string) => {
    const [addr, fam] = await Promise.all([
      supabase
        .from("client_addresses")
        .select("*")
        .eq("client_id", clientId)
        .order("is_default", { ascending: false }),
      supabase
        .from("family_members")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at"),
    ]);
    setAddresses((addr.data ?? []) as DbClientAddress[]);
    setFamilyMembers((fam.data ?? []) as DbFamilyMember[]);
  };

  const clientLogin = async (email: string, password: string) => {
    const { data: authData, error: authErr } =
      await supabase.auth.signInWithPassword({ email, password });
    if (authErr) throw new Error("بيانات الدخول غير صحيحة");
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("auth_id", authData.user.id)
      .single();
    if (!data) {
      await supabase.auth.signOut();
      throw new Error("لم يتم العثور على حسابك — جرّب إنشاء حساب جديد");
    }
    await onClientReady(data as DbClient);
  };

  const clientRegister = async (input: ClientRegisterInput) => {
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
    });
    if (authErr) {
      throw new Error(
        authErr.message.includes("already") ? "البريد مسجّل بالفعل — جرّب تسجيل الدخول" : authErr.message
      );
    }
    const userId = authData?.user?.id ?? authData?.session?.user?.id;
    if (!userId) throw new Error("✅ تم إنشاء الحساب — تحقق من بريدك الإلكتروني لتأكيده ثم سجّل دخول");

    const { data: newClient, error: cErr } = await supabase
      .from("clients")
      .insert([{ auth_id: userId, name: input.name, phone: input.phone, email: input.email }])
      .select()
      .single();
    if (cErr) throw new Error(cErr.message);
    await onClientReady(newClient as DbClient);
  };

  const clientLogout = async () => {
    await supabase.auth.signOut();
    setClient(null);
    setAddresses([]);
    setFamilyMembers([]);
    const cleared: CustomerProfile = { ...DEFAULT_PROFILE };
    setProfile(cleared);
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(cleared)).catch(() => {});
  };

  const clientResetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://malaaz-plum.vercel.app/client.html",
    });
    if (error) throw new Error(error.message);
  };

  // ─── العناوين المحفوظة ────────────────────────────────────────────────────
  const addAddress = async (address: string, area: string, isDefault: boolean) => {
    if (!client) return;
    if (isDefault) {
      await supabase.from("client_addresses").update({ is_default: false }).eq("client_id", client.id);
    }
    const { error } = await supabase
      .from("client_addresses")
      .insert([{ client_id: client.id, address, area, is_default: isDefault }]);
    if (error) throw new Error(error.message);
    loadClientData(client.id);
  };

  const deleteAddress = async (id: string) => {
    if (!client) return;
    await supabase.from("client_addresses").delete().eq("id", id);
    loadClientData(client.id);
  };

  const setDefaultAddress = async (id: string) => {
    if (!client) return;
    await supabase.from("client_addresses").update({ is_default: false }).eq("client_id", client.id);
    await supabase.from("client_addresses").update({ is_default: true }).eq("id", id);
    loadClientData(client.id);
  };

  // ─── أفراد العائلة ───────────────────────────────────────────────────────
  const addFamilyMember = async (m: { name: string; relation?: string; birthYear?: number; notes?: string }) => {
    if (!client) return;
    const { error } = await supabase.from("family_members").insert([{
      client_id: client.id,
      name: m.name,
      relation: m.relation ?? null,
      birth_year: m.birthYear ?? null,
      notes: m.notes ?? null,
    }]);
    if (error) throw new Error(error.message);
    loadClientData(client.id);
  };

  const deleteFamilyMember = async (id: string) => {
    if (!client) return;
    await supabase.from("family_members").delete().eq("id", id);
    loadClientData(client.id);
  };

  const updateFamilyMember = async (id: string, m: { name: string; relation?: string; birthYear?: number; notes?: string }) => {
    if (!client) return;
    const { error } = await supabase.from("family_members").update({
      name: m.name,
      relation: m.relation ?? null,
      birth_year: m.birthYear ?? null,
      notes: m.notes ?? null,
    }).eq("id", id);
    if (error) throw new Error(error.message);
    loadClientData(client.id);
  };

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
    if (!profile.phone && !client) return;
    setLoadingBookings(true);
    try {
      // العميل المسجّل بيشوف حجوزاته من السيرفر مباشرة (RLS بتسمح له) + أي حجز قديم
      // اتعمل كزائر بنفس رقم هاتفه (قبل ما يربط حسابه عن طريق link_my_bookings)
      const query = client
        ? supabase
            .from("bookings")
            .select("*")
            .or(`client_id.eq.${client.id}${profile.phone ? `,phone.eq.${profile.phone}` : ""}`)
        : supabase.from("bookings").select("*").eq("phone", profile.phone);
      const { data, error } = await query.order("created_at", { ascending: false });

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
  }, [profile.phone, providers, client?.id]);

  useEffect(() => {
    if (profile.phone || client) {
      refreshBookings();
      // تسجيل توكن الإشعارات — عشان توصله تحديثات حجوزاته push بدل الإيميل
      if (profile.phone) registerClientPushToken(profile.phone).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.phone, client?.id]);

  // ─── Profile actions ─────────────────────────────────────────────────────
  const updateProfile = async (next: Partial<CustomerProfile>) => {
    const merged = { ...profile, ...next };
    setProfile(merged);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
    // العميل المسجّل: مزامنة بياناته مع السيرفر (زي client.html)
    if (client) {
      supabase
        .from("clients")
        .update({
          name: merged.name || client.name,
          phone: merged.phone || client.phone || null,
          email: merged.email || null,
          phone2: merged.phone2 || null,
          whatsapp: merged.whatsapp || null,
        })
        .eq("id", client.id)
        .then(() => {});
    }
  };

  const logout = async () => {
    setProfile(DEFAULT_PROFILE);
    setBookings([]);
    await AsyncStorage.multiRemove([PROFILE_KEY, BOOKINGS_KEY]);
  };

  // ─── Create booking ───────────────────────────────────────────────────────
  const createBooking = async (input: CreateBookingInput): Promise<Booking> => {
    // input.patientPhone/patientName يأتيان من الفورم مباشرة (قبل تحديث profile state)
    // client بيوفر fallback لو profile لسه ما اتحدثش (race condition بعد اللوجين)
    const resolvedName = input.patientName || profile.name || client?.name || "";
    const resolvedPhone = input.patientPhone || profile.phone || client?.phone || "";
    if (!resolvedName || !resolvedPhone) {
      throw new Error("يرجى إدخال بياناتك أولاً");
    }

    // بنولّد الـ id محلياً لأن RLS بيمنع قراءة الصف بعد الإدراج
    const id = makeLocalId();
    const appointmentTime =
      [input.scheduledDate, input.scheduledTime].filter(Boolean).join(" ") || null;

    const resolvedAddress = input.patientAddress || profile.address || null;
    const resolvedArea =
      input.patientArea ||
      profile.area ||
      resolvedAddress?.split(/[،,]/)[0]?.trim().slice(0, 40) ||
      profile.city ||
      null;

    const bookingData = {
      id,
      patient_name: resolvedName,
      phone: resolvedPhone,
      client_id: client?.id ?? null,
      patient_email: input.patientEmail || profile.email || null,
      address: resolvedAddress,
      area: resolvedArea,
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
      on_way_at: null,
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
      bookings: visibleBookings,
      loadingBookings,
      createBooking,
      cancelBooking,
      addReview,
      refreshBookings,
      client,
      clientLogin,
      clientRegister,
      clientLogout,
      clientResetPassword,
      addresses,
      addAddress,
      deleteAddress,
      setDefaultAddress,
      familyMembers,
      addFamilyMember,
      deleteFamilyMember,
      updateFamilyMember,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, isHydrated, providers, loadingProviders, subServices, coverageAreas, providerReviews, visibleBookings, loadingBookings, client, addresses, familyMembers]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
