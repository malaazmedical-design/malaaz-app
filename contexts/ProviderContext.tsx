import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { Linking } from "react-native";

import { sendMalaazEmail } from "@/lib/emailjs";
import {
  supabase,
  DbBooking,
  DbProvider,
  DbSubService,
  DbCoverageArea,
  DbProviderService,
} from "@/lib/supabase";

export const SITE_URL = "https://malaaz-plum.vercel.app";

export type ProviderRegisterInput = {
  name: string;
  email: string;
  password: string;
  phone: string;
  serviceType: string;
  specialty: string;
  areas: string;
};

export type ProviderProfileInput = {
  name: string;
  phone: string;
  experience: number | null;
  bio: string;
  areas: string[];
  serviceType: string;
  grade: string;
  specialty: string | null;
  price: number | null;
  photoUrl?: string | null;
};

type ProviderContextValue = {
  initializing: boolean;
  provider: DbProvider | null;
  bookings: DbBooking[];
  loadingBookings: boolean;
  subServices: DbSubService[];
  areas: DbCoverageArea[];
  myServices: DbProviderService[];

  login: (email: string, password: string) => Promise<void>;
  register: (input: ProviderRegisterInput) => Promise<string>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;

  refreshAll: () => Promise<void>;
  toggleAvailability: (value: boolean) => Promise<void>;
  updateBookingStatus: (
    id: string,
    status: "confirmed" | "completed" | "cancelled"
  ) => Promise<void>;
  saveProfile: (input: ProviderProfileInput) => Promise<void>;
  saveMyServices: (
    rows: { sub_service_id: string; custom_price: number | null }[]
  ) => Promise<void>;
};

const ProviderContext = createContext<ProviderContextValue | undefined>(undefined);

export function ProviderProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [provider, setProvider] = useState<DbProvider | null>(null);
  const [bookings, setBookings] = useState<DbBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [subServices, setSubServices] = useState<DbSubService[]>([]);
  const [areas, setAreas] = useState<DbCoverageArea[]>([]);
  const [myServices, setMyServices] = useState<DbProviderService[]>([]);

  // ─── استرجاع الجلسة المحفوظة ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data } = await supabase
            .from("providers")
            .select("*")
            .eq("user_id", session.user.id)
            .single();
          if (data && data.status === "active") setProvider(data as DbProvider);
        }
      } catch {
        // ignore
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  // ─── تسجيل الدخول (نفس منطق provider.html) ───────────────────────────────
  const login = async (email: string, password: string) => {
    const { data: authData, error: authErr } =
      await supabase.auth.signInWithPassword({ email, password });
    if (authErr) throw new Error("بيانات الدخول غلط — تحقق من البريد وكلمة المرور");

    const { data, error } = await supabase
      .from("providers")
      .select("*")
      .eq("user_id", authData.user.id)
      .single();

    if (error || !data) {
      await supabase.auth.signOut();
      throw new Error("لم يتم العثور على ملف مقدم الخدمة — تواصل مع الإدارة");
    }
    if (data.status === "pending") {
      await supabase.auth.signOut();
      throw new Error("حسابك قيد المراجعة من الأدمن");
    }
    if (data.status === "suspended") {
      await supabase.auth.signOut();
      throw new Error("تم إيقاف حسابك — تواصل مع الإدارة");
    }
    setProvider(data as DbProvider);
  };

  // ─── حساب جديد — auth + صف providers بحالة pending ───────────────────────
  const register = async (input: ProviderRegisterInput): Promise<string> => {
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
    });
    if (authErr) {
      throw new Error(
        authErr.message.includes("already")
          ? "البريد مسجّل بالفعل"
          : authErr.message
      );
    }

    const userId = authData?.user?.id ?? authData?.session?.user?.id;
    if (!userId) {
      return "✅ تم إنشاء الحساب — تحقق من بريدك الإلكتروني لتأكيد الحساب";
    }

    const areasList = input.areas.split(",").map((a) => a.trim()).filter(Boolean);
    const { error: provErr } = await supabase.from("providers").insert([{
      user_id: userId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      service_type: input.serviceType,
      specialty: input.specialty,
      area: areasList[0] ?? input.areas,
      areas: areasList.join(", "),
      status: "pending",
      is_available: false,
      rating: 5,
    }]);
    if (provErr) throw new Error("خطأ في إنشاء الملف: " + provErr.message);

    // إشعار الأدمن بمقدم جديد (نفس قالب الموقع)
    sendMalaazEmail({
      to_email: "malaaz.medical@gmail.com",
      subject: `👨‍⚕️ مقدم خدمة جديد سجّل — ${input.name}`,
      title: "👨‍⚕️ مقدم خدمة جديد!",
      title_color: "#2e7d32",
      message: "مقدم خدمة جديد سجّل وفي انتظار موافقتك. راجع بياناته في لوحة التحكم.",
      details:
        `👤 الاسم: ${input.name}<br>` +
        `📱 الموبايل: ${input.phone}<br>` +
        `✉️ الإيميل: ${input.email}<br>` +
        `⚕️ نوع الخدمة: ${input.serviceType || "—"}<br>` +
        `🩺 التخصص: ${input.specialty || "—"}<br>` +
        `📍 المناطق: ${areasList.join("، ") || "—"}`,
      button_text: "✅ مراجعة الطلب",
      button_link: `${SITE_URL}/admin.html`,
      button_color: "#c9a84c",
    });

    return "✅ تم إنشاء الحساب — انتظر موافقة الأدمن";
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/provider.html`,
    });
    if (error) throw new Error(error.message);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setProvider(null);
    setBookings([]);
    setMyServices([]);
  };

  // ─── تحميل البيانات ───────────────────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    if (!provider) return;
    setLoadingBookings(true);
    try {
      const [bk, subs, ar, mine, prov] = await Promise.all([
        supabase
          .from("bookings")
          .select("*")
          .eq("provider_id", provider.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("sub_services")
          .select("*")
          .eq("is_active", true)
          .order("service_name")
          .order("name"),
        supabase
          .from("coverage_areas")
          .select("*")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("provider_services")
          .select("*")
          .eq("provider_id", provider.id),
        supabase.from("providers").select("*").eq("id", provider.id).single(),
      ]);
      setBookings((bk.data ?? []) as DbBooking[]);
      setSubServices((subs.data ?? []) as DbSubService[]);
      setAreas((ar.data ?? []) as DbCoverageArea[]);
      setMyServices((mine.data ?? []) as DbProviderService[]);
      if (prov.data) setProvider(prov.data as DbProvider);
    } catch (err) {
      console.error("Provider refresh error:", err);
    } finally {
      setLoadingBookings(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider?.id]);

  useEffect(() => {
    if (provider?.id) refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider?.id]);

  // ─── متاح الآن ────────────────────────────────────────────────────────────
  const toggleAvailability = async (value: boolean) => {
    if (!provider) return;
    setProvider({ ...provider, is_available: value });
    const { error } = await supabase
      .from("providers")
      .update({ is_available: value })
      .eq("id", provider.id);
    if (error) {
      setProvider({ ...provider, is_available: !value });
      throw new Error(error.message);
    }
  };

  // ─── تحديث حالة الحجز + إشعارات العميل (نفس منطق الموقع) ────────────────
  const updateBookingStatus = async (
    id: string,
    status: "confirmed" | "completed" | "cancelled"
  ) => {
    const { data, error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", id)
      .select();
    if (error) throw new Error(error.message);
    if (!data || data.length === 0)
      throw new Error("لم يتم التحديث — تحقق من الصلاحيات");

    const booking = bookings.find((b) => b.id === id);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    if (!booking) return;

    if (status === "confirmed" && booking.patient_email) {
      sendMalaazEmail({
        to_email: booking.patient_email,
        subject: "✅ تم تأكيد حجزك مع ملاذ",
        title: "✅ تم تأكيد حجزك!",
        title_color: "#2e7d32",
        message: `أهلاً ${booking.patient_name || ""} 💙 تم تأكيد حجزك بنجاح. سيتم التواصل معك لتنسيق الزيارة.`,
        details:
          `⚕️ الخدمة: ${booking.service_type || "—"}<br>` +
          `📍 المنطقة: ${booking.area || "—"}<br>` +
          `🕐 الميعاد: ${booking.appointment_time || "—"}<br>` +
          `👨‍⚕️ مقدم الخدمة: ${provider?.name || "سيتم التواصل معك"}`,
        button_text: "📱 تواصل معنا",
        button_link: "https://wa.me/201039091989",
        button_color: "#25D366",
      });
    }

    if (status === "cancelled" && booking.patient_email) {
      sendMalaazEmail({
        to_email: booking.patient_email,
        subject: "تحديث بخصوص حجزك مع ملاذ",
        title: "⚠️ تعذّر تأكيد حجزك",
        title_color: "#c62828",
        message: `عزيزي ${booking.patient_name || ""}، نعتذر — تعذّر تأكيد حجزك في الوقت المحدد. يمكنك اختيار مقدم آخر أو التواصل معنا.`,
        details:
          `⚕️ الخدمة: ${booking.service_type || "—"}<br>` +
          `📍 المنطقة: ${booking.area || "—"}<br>` +
          `🕐 الميعاد: ${booking.appointment_time || "—"}`,
        button_text: "🔍 اختر مقدم خدمة آخر",
        button_link: SITE_URL,
        button_color: "#c9a84c",
      });
    }

    if (status === "completed" && booking.phone) {
      // فتح واتساب برسالة التقييم للعميل
      const pid = booking.provider_id || provider?.id;
      const reviewLink = `${SITE_URL}/review.html?bid=${id}&svc=${encodeURIComponent(booking.service_type || "")}${pid ? `&pid=${pid}` : ""}`;
      const waMsg = encodeURIComponent(
        `مرحباً ${booking.patient_name || ""} 👋\n\n` +
          `شكراً لاختيارك منصة *ملاذ* 🏥\n\n` +
          `نتمنى تكون تجربتك كانت مميزة 😊\n\n` +
          `قيّم تجربتك في دقيقة:\n⭐ ${reviewLink}\n\n` +
          `رأيك بيفرق معانا كتير ❤️`
      );
      const clientPhone = `20${booking.phone.replace(/^0/, "")}`;
      Linking.openURL(`https://wa.me/${clientPhone}?text=${waMsg}`).catch(() => {});
    }
  };

  // ─── حفظ الملف الشخصي ────────────────────────────────────────────────────
  const saveProfile = async (input: ProviderProfileInput) => {
    if (!provider) return;
    const payload: Record<string, unknown> = {
      name: input.name,
      phone: input.phone,
      experience: input.experience,
      bio: input.bio,
      areas: input.areas.join(", "),
      area: input.areas[0] ?? null,
      service_type: input.serviceType,
      grade: input.grade,
      specialty: input.specialty,
      price: input.price,
    };
    if (input.photoUrl) payload.photo_url = input.photoUrl;

    const { error } = await supabase
      .from("providers")
      .update(payload)
      .eq("id", provider.id);
    if (error) throw new Error(error.message);
    setProvider({ ...provider, ...(payload as Partial<DbProvider>) });
  };

  // ─── حفظ الخدمات والأسعار (حذف ثم إدراج زي الموقع) ──────────────────────
  const saveMyServices = async (
    rows: { sub_service_id: string; custom_price: number | null }[]
  ) => {
    if (!provider) return;
    const svcType = provider.service_type || "كشف منزلي";
    const subIds = subServices
      .filter((s) => s.service_name === svcType && s.group_name !== "grade")
      .map((s) => s.id);

    await supabase
      .from("provider_services")
      .delete()
      .eq("provider_id", provider.id)
      .in("sub_service_id", subIds);

    if (rows.length) {
      const { error } = await supabase.from("provider_services").insert(
        rows.map((r) => ({
          provider_id: provider.id,
          sub_service_id: r.sub_service_id,
          custom_price: r.custom_price,
          is_active: true,
        }))
      );
      if (error) throw new Error(error.message);
    }

    const { data } = await supabase
      .from("provider_services")
      .select("*")
      .eq("provider_id", provider.id);
    setMyServices((data ?? []) as DbProviderService[]);
  };

  const value = useMemo<ProviderContextValue>(
    () => ({
      initializing,
      provider,
      bookings,
      loadingBookings,
      subServices,
      areas,
      myServices,
      login,
      register,
      resetPassword,
      logout,
      refreshAll,
      toggleAvailability,
      updateBookingStatus,
      saveProfile,
      saveMyServices,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initializing, provider, bookings, loadingBookings, subServices, areas, myServices, refreshAll]
  );

  return (
    <ProviderContext.Provider value={value}>{children}</ProviderContext.Provider>
  );
}

export function useProvider() {
  const ctx = useContext(ProviderContext);
  if (!ctx) throw new Error("useProvider must be used within ProviderProvider");
  return ctx;
}
