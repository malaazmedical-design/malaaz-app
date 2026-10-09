import { Redirect, useLocalSearchParams } from "expo-router";
import React from "react";

// Booking an online consultation now lives inside the doctor's page (service list -> "استشارة أونلاين" -> channel boxes).
// This route stays only as a redirect for old links (follow-up button, no-show rebooking, ask-a-doctor offer).
export default function BookConsultationRedirect() {
  const { provider } = useLocalSearchParams<{ provider: string }>();
  return <Redirect href={{ pathname: "/provider/[id]", params: { id: provider ?? "", online: "1" } }} />;
}
