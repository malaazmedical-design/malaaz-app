// رقم الحجز المعروض: الرقم التسلسلي (B-1001) لو موجود، وإلا الشكل القديم (آخر حروف من المعرّف) للحجوزات اللي لسه من غير رقم
export function bookingLabel(b: { id: string; booking_number?: string | null }, short = 6): string {
  return b.booking_number || `#${b.id.slice(-short).toUpperCase()}`;
}
