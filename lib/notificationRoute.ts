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

  // provider side: a new offer (quick request) or a direct booking
  if (d.kind === "new_booking" || d.type === "OFFER_INSERT") {
    if (d.direct === true && bookingId) {
      router.push({ pathname: "/provider-portal/(ptabs)/bookings", params: { focus: bookingId } });
    } else {
      router.push("/provider-portal/(ptabs)/offers");
    }
    return;
  }

  // client side: status updates of their booking
  router.push("/(tabs)/bookings");
}
