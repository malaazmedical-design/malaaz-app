# تجهيز نسخة الأيفون (ReVoice و Provider)

النسخ دي ليها معرّفات (bundle id) مستقلة، فمش بتتعارض مع التطبيق الأصلي `com.malaaz.app` ولا بنلمسه:

| النسخة | iOS bundle id | بروفايل البناء |
|---|---|---|
| Malaaz ReVoice | `com.malaaz.homecare.mizotest` | `mizo-test-ios` (TestFlight) أو `mizo-test-sim` (محاكي) |
| Malaaz Provider | `com.malaaz.homecare.malaazprovider` | `mizo-provider-ios` (TestFlight) |

## اللي لازم تعمله إنت (مرة واحدة)
1. افتح حساب **Apple Developer Program** (99$/سنة). ده ضروري لأي تثبيت على موبايل حقيقي أو TestFlight.
2. في **App Store Connect** اعمل تطبيق لكل نسخة بنفس الـ bundle id (الاسم زي "Malaaz ReVoice"). مش هتنشره للعامة، بس لازم يكون موجود لـ TestFlight.
3. على جهازك (Terminal) شغّل مرة: `eas build -p ios --profile mizo-test-ios` وسجّل دخول بحساب أبل لما يسألك. ده بينشئ الشهادات ويحفظها عند Expo. بعدها البناء من GitHub Actions (`EAS Build — iOS`) بيشتغل من غير تدخل.
4. اختياري للرفع التلقائي لـ TestFlight: `eas submit` محتاج مفتاح App Store Connect API (EAS بيساعد في إنشائه).

## ملاحظات
- نسخ الأيفون ما فيهاش فيسبوك (لأن `FACEBOOK_APP_ID` مش معرّف للنسخ دي)، يعني مفيش تتبع إعلانات. وده مقصود للاختبار.
- مصدر التثبيت (install referrer) أندرويد بس.
- الإشعارات (APNs) بتتفعّل من EAS في خطوة الشهادات.
- قبل نشر نسخة نهائية على المتجر: حذف الحساب من التطبيق، وصف الخصوصية لأبل، وتسجيل الدخول بأبل لو التطبيق فيه تسجيل بجوجل. دول مش مطلوبين لـ TestFlight الداخلي.
