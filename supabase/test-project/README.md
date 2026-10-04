# مشروع Supabase التجريبي (ميزو تيست)

ملفات تجهيز قاعدة بيانات **منفصلة تمامًا** عن قاعدة التطبيق الأصلي. لا تحتوي على بيانات حقيقية ولا أسرار.

## الترتيب
1. أنشئ مشروع Supabase جديد (الخطة المجانية تكفي). **لا تستخدم المشروع الأصلي.**
2. في **SQL Editor** نفّذ الملفات بالترتيب (الصق محتوى كل ملف وشغّله):
   `01_tables.sql` ← `02_functions.sql` ← `03_rls_policies.sql` ← `04_storage_realtime.sql` ← `05_new_columns.sql`
3. (اختياري) بيانات مرجعية: شغّل `export-reference-data.sql` على المشروع **الأصلي** (قراءة فقط)،
   وانسخ الناتج `reference_data_sql` وشغّله على المشروع التجريبي.
4. `06_seed_test_providers.sql`: ٩ مقدمي خدمة وهميين (إيميلاتهم @example.invalid) مع خدماتهم وتقييمات تجريبية. آمن لإعادة التشغيل.
5. `07_register_client.sql`: دالة `register_my_client` لإنشاء/ربط صف العميل بعد أي تسجيل دخول (إيميل أو جوجل) مع رقم الموبايل، ومنع حسابين بنفس الرقم. بدون SMS.
6. Authentication ← Providers ← Email: أوقف **Confirm email** لتسهيل إنشاء حسابات التجربة.
7. أعط المطوّر `Project URL` و`anon public key` فقط. **لا تشارك `service_role` أبدًا.**

## ما الذي تغيّر عن الأصلي عمدًا
- دوال `notify_booking_change` و`notify_booking_offer_change` أصبحت لا تفعل شيئًا،
  و`escalate_pending_bookings` بلا إرسال إيميل. في الأصل بتنادي دوال Edge على المشروع الأصلي بسرّ مكتوب داخل الدالة،
  ونسخها كما هي كان سيرسل إشعارات وإيميلات حقيقية من بيئة التجربة.
- لا يوجد جدول `pg_cron` للتصعيد، ولا دوال Edge، ولا ملفات في الـbuckets.
- `05_new_columns.sql` يضيف `birth_date` و`gender` على `clients` (للتجربة فقط).
