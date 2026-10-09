-- المرحلة 1: رقم واتساب منفصل لمقدم الخدمة (على مشروع الاختبار فقط)
alter table public.providers add column if not exists whatsapp text;
