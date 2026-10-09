import { router } from "expo-router";

// Where a tapped push notification should land. Payloads come from the DB triggers (supabase/test-project/11)
// and from local medicine reminders.
export function routeForNotification(data: Record<string, unknown> | undefined | null): void {
  const d = data ?? {};
  const bookingId = typeof d.booking_id === "string" ? d.booking_id : undefined;

  if (d.type === "medicine") {
    router.push("/medicines");
    return;
  }

  // "اسأل طبيب": a question routed to the doctor's specialty / the answer arriving to the client
  const caseId = typeof d.case_id === "string" ? d.case_id : undefined;
  if (d.kind === "ask_new") {
    router.push({ pathname: "/provider-portal/(ptabs)/bookings", params: { seg: "cases", t: String(Date.now()) } });
    return;
  }
  if (d.kind === "ask_answer" && caseId) {
    router.push(`/ask-doctor/${caseId}`);
    return;
  }

  const consultId = typeof d.consultation_id === "string" ? d.consultation_id : undefined;
  if (d.kind === "consult" && consultId) {
    router.push(d.role === "provider" ? (`/provider-portal/consult/${consultId}` as any) : (`/consult/${consultId}` as any));
    return;
  }

  // provider side: a new offer (quick request) or a direct booking
  if (d.kind === "new_booking" || d.type === "OFFER_INSERT") {
    if (d.direct === true && bookingId) {
      router.push({ pathname: "/provider-portal/(ptabs)/bookings", params: { focus: bookingId, t: String(Date.now()) } });
    } else {
      router.push("/provider-portal/(ptabs)/offers");
    }
    return;
  }

  // client side: status updates of their booking
  router.push("/(tabs)/bookings");
}
