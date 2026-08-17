// إشعارات ملاذ — بتتنادى من تريجر قاعدة البيانات عند إنشاء حجز أو تغيير حالته أو تحرك المقدم
// كمان بتتنادى لما بيتعمل offer لمقدم خدمة (OFFER_INSERT)
import { createClient } from "npm:@supabase/supabase-js@2";

const WEBHOOK_SECRET = "4f6e073da3168f12f3e3181b0c62ab71776d267fee8293b7";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ADMIN_EMAIL = "malaaz.medical@gmail.com";
const ADMIN_DASHBOARD = "https://malaaz-plum.vercel.app";

type Booking = {
  id: string;
  patient_name: string | null;
  phone: string | null;
  area: string | null;
  appointment_time: string | null;
  service_type: string | null;
  sub_option: string | null;
  status: string;
  provider_id: string | null;
  on_way_at: string | null;
};

type BookingOffer = {
  id: string;
  booking_id: string;
  provider_id: string;
  distance_km: number | null;
  status: string;
};

async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown>
) {
  if (!tokens.length) return;

  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    data,
    sound: "default",
    priority: "high",
  }));

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });

  const result = await res.json();
  console.log("expo push response:", JSON.stringify(result));

  if (result?.data && Array.isArray(result.data)) {
    const staleTokens: string[] = [];
    result.data.forEach((ticket: { status: string; details?: { error?: string } }, i: number) => {
      if (ticket.status === "error") {
        console.error(`expo ticket error for token ${tokens[i]}:`, JSON.stringify(ticket));
        if (ticket.details?.error === "DeviceNotRegistered") {
          staleTokens.push(tokens[i]);
        }
      }
    });
    if (staleTokens.length > 0) {
      const { error } = await supabase
        .from("push_tokens")
        .delete()
        .in("expo_token", staleTokens);
      if (error) {
        console.error("failed to delete stale tokens:", error.message);
      } else {
        console.log("deleted stale tokens:", staleTokens);
      }
    }
  }
}

async function clientTokens(phone: string | null): Promise<string[]> {
  if (!phone) return [];
  const { data } = await supabase
    .from("push_tokens")
    .select("expo_token")
    .eq("owner_type", "client")
    .eq("phone", phone)
    .order("updated_at", { ascending: false })
    .limit(3);
  return (data ?? []).map((r) => r.expo_token);
}

async function providerTokens(providerId: string | null): Promise<string[]> {
  if (!providerId) return [];
  const { data } = await supabase
    .from("push_tokens")
    .select("expo_token")
    .eq("owner_type", "provider")
    .eq("provider_id", providerId)
    .order("updated_at", { ascending: false })
    .limit(2);
  return (data ?? []).map((r) => r.expo_token);
}

async function notifyAdminNewBooking(booking: Booking) {
  const isDirect = !!booking.provider_id;
  const svc = booking.sub_option
    ? `${booking.service_type} — ${booking.sub_option}`
    : booking.service_type ?? "";

  try {
    const { error } = await supabase.functions.invoke("send-email", {
      body: {
        to_email: ADMIN_EMAIL,
        subject: `${isDirect ? "🎯 حجز مباشر" : "📋 حجز عام"} — ${booking.patient_name ?? "عميل"}`,
        title: isDirect ? "🎯 حجز مباشر جديد" : "📋 حجز عام جديد",
        title_color: isDirect ? "#1C2B2A" : "#C9A84C",
        message: isDirect
          ? "وصل حجز مباشر جديد على ملاذ — سيُعيَّن المقدم فوراً."
          : "وصل حجز عام جديد على ملاذ — تم توزيع العروض على المقدمين النشطين.",
        details:
          `👤 الاسم: ${booking.patient_name ?? "—"}<br>` +
          `📱 الهاتف: ${booking.phone ?? "—"}<br>` +
          `⚕️ الخدمة: ${svc}<br>` +
          `📍 المنطقة: ${booking.area ?? "—"}<br>` +
          `🕐 الموعد: ${booking.appointment_time ?? "—"}<br>` +
          `🔖 رقم الحجز: ${booking.id}`,
        button_text: "عرض لوحة التحكم",
        button_link: ADMIN_DASHBOARD,
        button_color: isDirect ? "#1C2B2A" : "#C9A84C",
      },
    });
    if (error) console.error("notifyAdminNewBooking invoke error:", error.message);
    else console.log("admin email sent for booking:", booking.id);
  } catch (e) {
    console.error("notifyAdminNewBooking failed:", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  const payload = (await req.json()) as {
    type: "INSERT" | "UPDATE" | "OFFER_INSERT";
    record: Booking | BookingOffer;
    old_record: Booking | null;
  };

  const { type } = payload;

  // ─── حجز جديد عبر الـ offers (quick-request flow) ───────────────────────
  if (type === "OFFER_INSERT") {
    const offer = payload.record as BookingOffer;

    const { data: booking } = await supabase
      .from("bookings")
      .select("patient_name, service_type, sub_option, area, appointment_time")
      .eq("id", offer.booking_id)
      .single();

    const svc = booking?.sub_option
      ? `${booking.service_type} — ${booking.sub_option}`
      : booking?.service_type ?? "";

    const tokens = await providerTokens(offer.provider_id);
    console.log(`OFFER_INSERT: provider=${offer.provider_id}, tokens=${tokens.length}`);

    await sendExpoPush(
      tokens,
      "📋 حجز جديد وصلك!",
      `${booking?.patient_name ?? "عميل"} · ${svc} · ${booking?.area ?? ""} · ${booking?.appointment_time ?? ""}`,
      { kind: "new_booking", booking_id: offer.booking_id }
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ─── حجز مباشر أو تحديث حالة ─────────────────────────────────────────────
  const record = payload.record as Booking;
  const old_record = payload.old_record as Booking | null;

  const svc = record.sub_option
    ? `${record.service_type} — ${record.sub_option}`
    : record.service_type ?? "";

  if (type === "INSERT") {
    // إيميل للأدمن على كل حجز جديد (عام أو مباشر، من التطبيق أو الموقع)
    await notifyAdminNewBooking(record);

    // لو حجز مباشر: push للمقدم المحدد كمان
    if (record.provider_id) {
      const tokens = await providerTokens(record.provider_id);
      console.log(`INSERT direct: provider=${record.provider_id}, tokens=${tokens.length}`);
      await sendExpoPush(
        tokens,
        "📋 حجز جديد وصلك!",
        `${record.patient_name ?? "عميل"} · ${svc} · ${record.area ?? ""} · ${record.appointment_time ?? ""}`,
        { kind: "new_booking", booking_id: record.id }
      );
    }
  }

  if (type === "UPDATE" && old_record) {
    // المقدم في الطريق → إشعار للعميل
    if (!old_record.on_way_at && record.on_way_at) {
      const tokens = await clientTokens(record.phone);
      console.log(`on_way: phone=${record.phone}, tokens=${tokens.length}`);
      await sendExpoPush(
        tokens,
        "🚗 مقدم الخدمة في الطريق إليك!",
        `${svc} — استعد، مقدم الخدمة اتحرك ناحيتك 💙`,
        { kind: "on_way", booking_id: record.id }
      );
    }

    if (old_record.status !== record.status) {
      const tokens = await clientTokens(record.phone);
      console.log(`status change: ${old_record.status} → ${record.status}, phone=${record.phone}, tokens=${tokens.length}`);

      if (record.status === "confirmed") {
        await sendExpoPush(
          tokens,
          "✅ تم تأكيد حجزك!",
          `${svc} · ${record.appointment_time ?? ""} — سيتم التواصل معك لتنسيق الزيارة 💙`,
          { kind: "booking_confirmed", booking_id: record.id }
        );
      } else if (record.status === "cancelled") {
        await sendExpoPush(
          tokens,
          "⚠️ تحديث بخصوص حجزك",
          `نعتذر — تعذّر تأكيد حجز ${svc}. يمكنك اختيار مقدم آخر من التطبيق`,
          { kind: "booking_cancelled", booking_id: record.id }
        );
      } else if (record.status === "completed") {
        await sendExpoPush(
          tokens,
          "🎉 اكتملت خدمتك مع ملاذ",
          "نتمنى تكون تجربتك كانت مميزة — قيّم تجربتك في دقيقة ⭐",
          { kind: "booking_completed", booking_id: record.id }
        );
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
