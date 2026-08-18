-- دالة trigger تستدعي create_booking_offers تلقائيًا عند إنشاء أي حجز عام
-- بيغطي الموقع والتطبيق وأي مصدر تاني بدون تغيير في كود العميل
CREATE OR REPLACE FUNCTION public.auto_create_booking_offers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- فقط للحجوزات العامة (provider_id = null)
  -- الحجوزات المباشرة عندها مقدم محدد مسبقاً ومش محتاجة offers
  IF NEW.provider_id IS NULL THEN
    PERFORM public.create_booking_offers(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_booking_offers ON public.bookings;
CREATE TRIGGER trg_auto_booking_offers
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_booking_offers();
