# Play Console — Data safety + Advertising ID + فحص قبل الـ AAB

## 1) Advertising ID (Policy ← App content ← Advertising ID)
- "Does your app use advertising ID?" → **Yes**
- الاستخدام: **Analytics** و **Advertising or marketing** (Firebase Analytics + قياس إعلانات ميتا/جوجل).
- (Firebase Analytics بيضيف إذن `com.google.android.gms.permission.AD_ID` تلقائي في الـ manifest، فلازم الإجابة تبقى Yes.)

## 2) Data safety (Policy ← App content ← Data safety)
**Data collected & shared** — لكل بند: Collected = Yes، وShared حسب الجدول، وكلها "مش اختيارية" ما عدا اللي مكتوب.

| النوع | Collected | Shared | الغرض |
|---|---|---|---|
| Name | Yes | Yes (مقدم الخدمة المعيّن للحجز) | App functionality, Account management |
| Email address | Yes | No | Account management |
| Phone number | Yes | Yes (مقدم الخدمة المعيّن) | App functionality, Account management |
| Address / Approximate + Precise location | Yes | Yes (مقدم الخدمة المعيّن) | App functionality (أثناء استخدام التطبيق فقط) |
| Health info (بيانات طبية: ملفات، ملاحظات زيارة، تقارير) | Yes | Yes (الطبيب/المقدم المعيّن) | App functionality |
| Photos and videos / Files and docs | Yes | Yes (المقدم المعيّن) | App functionality |
| Audio (مكالمات صوت/فيديو) | Yes | Yes (الطرف الآخر في المكالمة) | App functionality — المكالمة بتتنقل عبر LiveKit ومش بتتسجّل |
| Messages (استشارات / ask doctor) | Yes | Yes (الطبيب) | App functionality |
| User IDs (معرّف الحساب) | Yes | No | App functionality, Analytics |
| Device or other IDs (Advertising ID + Firebase installation ID + push token) | Yes | **Yes** (Google / Meta) | Analytics, Advertising or marketing, App functionality |
| App interactions (فتح التطبيق، تسجيل، طلب حجز) | Yes | **Yes** (Google / Meta) | Analytics, Advertising or marketing |
| Crash logs / Diagnostics | سيبها No لو مفيش Crashlytics | — | — |
| Payment info | **No** (الدفع كاش/محفظة/إنستاباي خارج التطبيق) | — | — |

**Security practices**
- Data encrypted in transit: **Yes**
- Users can request data deletion: **Yes** → رابط حذف الحساب (صفحة account-deletion على موقع Vercel) + حذف من داخل التطبيق.
- Privacy policy URL: صفحة الخصوصية على موقع Vercel.

**ملاحظات:** "Shared" في Play = نقل لطرف تالت. الموردين اللي بيشتغلوا باسمنا (Supabase, LiveKit, Expo/FCM) = service providers ومش بيتحسبوا Shared؛ مقدم الخدمة وميتا وجوجل (للإعلان) بيتحسبوا.
بيانات الموقع: التطبيق مش بيجمع موقع في الخلفية (Foreground only).

## 3) الأذونات اللي لازم تتذكر في صفحة App content
Camera + Microphone + Bluetooth (مكالمات)، Notifications، Location (foreground). مفيش Foreground service location ولا Background location.

## 4) فحص قبل بناء الـ AAB

### أ) الـ keystore (مفتاح الرفع)
Play بيستنى توقيع الرفع (Upload key) بنفس الـ SHA-1 المسجّل عنده.
1. Play Console ← التطبيق ← **Test and release** ← **App signing** ← قسم **Upload key certificate** ← انسخ **SHA-1**.
2. على جهازك (أو أي مكان فيه الحساب): `npx eas-cli credentials -p android` ← **production** ← **Keystore** ← شوف **SHA1 Fingerprint**.
3. لازم يتطابقوا. لو مختلفين: Play Console ← App signing ← **Request upload key reset** (بياخد حوالي يومين)، أو ارفع الـ upload keystore الأصلي في EAS.
(مفيش حاجة أقدر أشوفها من هنا: مفيش دخول لحساب EAS/Play من الجلسة.)

### ب) versionCode
- Play بيرفض أي AAB versionCode بتاعه أقل من أو يساوي أعلى واحد اتنشر.
1. Play Console ← **Test and release** ← **Latest releases and bundles** ← شوف أعلى **Version code** (الإصدار 1.0.0 الحالي).
2. `npx eas-cli build:version:get -p android -e production` ← الرقم الحالي المخزّن في EAS (الـ build الجاي = الرقم + 1 بسبب autoIncrement).
3. لو رقم EAS الجاي **أقل أو يساوي** رقم Play: `npx eas-cli build:version:set -p android -e production` وحط رقم أعلى من Play (مثلاً Play + 1).
