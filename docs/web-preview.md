# نسخة الويب التجريبية (ReVoice)

- مشروع Vercel: `malaaz-revoice-web` (منفصل عن موقع ملاذ الأصلي)، بيبني من فرع `revoice` بإعدادات مشروع الاختبار (`APP_VARIANT=mizotest` + Supabase الاختباري).
- الرابط: `https://malaaz-revoice-web.vercel.app` — محمي بتسجيل دخول Vercel (Deployment Protection).
- أمر البناء والمجلد من `vercel.json` (بيعمل `npm install --legacy-peer-deps` ثم `expo export --platform web`).
- على الويب مش بتشتغل: الافتتاحية المتحركة، المكالمات الصوتية/الفيديو، الإشعارات، تتبع مصدر التثبيت.
