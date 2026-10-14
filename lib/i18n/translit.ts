// تحويل الأسماء الشخصية العربية لحروف إنجليزية (احتياطي لما مقدم الخدمة ما يكتبش اسمه بالإنجليزي).
// الأسماء الشائعة من قاموس بالتهجئة المعروفة في مصر، وغيرها بقواعد حروف بسيطة — الأدمن أو مقدم الخدمة يصلّح أي اسم من name_en.

const norm = (s: string) =>
  s.replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();

const NAMES_RAW: Record<string, string> = {
  // رجال
  محمد: "Mohamed", أحمد: "Ahmed", محمود: "Mahmoud", مصطفى: "Mostafa", علي: "Ali", حسن: "Hassan", حسين: "Hussein", إبراهيم: "Ibrahim", إسماعيل: "Ismail",
  يوسف: "Youssef", عمر: "Omar", خالد: "Khaled", عمرو: "Amr", طارق: "Tarek", ياسر: "Yasser", هشام: "Hesham", كريم: "Karim", سامح: "Sameh", سامي: "Sami",
  شريف: "Sherif", وائل: "Wael", ماجد: "Maged", عصام: "Essam", صلاح: "Salah", سمير: "Samir", نبيل: "Nabil", عادل: "Adel", أيمن: "Ayman", أسامة: "Osama",
  إسلام: "Islam", شادي: "Shady", فادي: "Fady", محسن: "Mohsen", رفعت: "Refaat", ماهر: "Maher", لطفي: "Lotfy", صبري: "Sabry", حلمي: "Helmy", سعد: "Saad",
  فاروق: "Farouk", رمضان: "Ramadan", سعيد: "Said", سيد: "Sayed", السيد: "El Sayed", جمال: "Gamal", كمال: "Kamal", هاني: "Hany", هانى: "Hany", حازم: "Hazem",
  باسم: "Basem", بهاء: "Bahaa", تامر: "Tamer", ثروت: "Tharwat", حاتم: "Hatem", حمدي: "Hamdy", رامي: "Ramy", رأفت: "Raafat", زياد: "Ziad", سلطان: "Sultan",
  سليمان: "Soliman", شعبان: "Shaaban", صبحي: "Sobhy", طه: "Taha", عاطف: "Atef", عبدالله: "Abdallah", عبدالرحمن: "Abdelrahman", عبدالعزيز: "Abdelaziz",
  عبدالفتاح: "Abdelfattah", عبدالحميد: "Abdelhamid", عبدالمنعم: "Abdelmoneim", عبدالرحيم: "Abdelrahim", عثمان: "Osman", عزت: "Ezzat", علاء: "Alaa",
  عماد: "Emad", غريب: "Ghareeb", فتحي: "Fathy", فريد: "Farid", فؤاد: "Fouad", كامل: "Kamel", لؤي: "Louay", مجدي: "Magdy", محسن_: "Mohsen", مدحت: "Medhat",
  مراد: "Mourad", مروان: "Marwan", معتز: "Moataz", منير: "Mounir", مؤمن: "Moemen", مينا: "Mina", نادر: "Nader", ناصر: "Nasser", نشأت: "Nashaat", هيثم: "Haitham",
  وليد: "Walid", ياسين: "Yassin", يحيى: "Yehia", يونس: "Younes", بيشوي: "Bishoy", مايكل: "Michael", جورج: "George", مارك: "Mark", بيتر: "Peter", ميخائيل: "Mikhail",
  عمار: "Ammar", أنس: "Anas", بلال: "Belal", حمزة: "Hamza", زكريا: "Zakaria", سيف: "Seif", صالح: "Saleh", عوض: "Awad", فهمي: "Fahmy", قاسم: "Kassem",
  متولي: "Metwally", مختار: "Mokhtar", مرسي: "Morsy", ممدوح: "Mamdouh", منصور: "Mansour", موسى: "Moussa", نصر: "Nasr", نعمان: "Noaman", هلال: "Helal", وجدي: "Wagdy",
  // سيدات
  نادية: "Nadia", ريم: "Reem", شيماء: "Shaimaa", منى: "Mona", هدى: "Hoda", سارة: "Sara", مريم: "Mariam", فاطمة: "Fatma", عائشة: "Aisha", نهى: "Noha",
  دعاء: "Doaa", إيمان: "Eman", أسماء: "Asmaa", آية: "Aya", نور: "Nour", سلمى: "Salma", ياسمين: "Yasmin", هبة: "Heba", رشا: "Rasha", داليا: "Dalia",
  أميرة: "Amira", إنجي: "Engy", ميار: "Mayar", مي: "Mai", ندى: "Nada", نيفين: "Nevine", هالة: "Hala", هند: "Hend", وفاء: "Wafaa", أمل: "Amal",
  آمال: "Amal", رانيا: "Rania", رحاب: "Rehab", سحر: "Sahar", سمر: "Samar", سناء: "Sanaa", سهير: "Soheir", عبير: "Abeer", علياء: "Aliaa", غادة: "Ghada",
  لمياء: "Lamiaa", لينا: "Lina", ليلى: "Layla", مروة: "Marwa", ملك: "Malak", منار: "Manar", مها: "Maha", ميرنا: "Mirna", نجلاء: "Naglaa", نرمين: "Nermine",
  نسمة: "Nesma", هاجر: "Hager", هنا: "Hana", يمنى: "Yomna", جيهان: "Gehan", حنان: "Hanan", خديجة: "Khadija", دينا: "Dina", رنا: "Rana", زينب: "Zeinab",
  شروق: "Shorouk", شهد: "Shahd", صفاء: "Safaa", ضحى: "Doha", فرح: "Farah", كلثوم: "Kalthoum", لبنى: "Lobna", ماجدة: "Magda", ماريا: "Maria", مرفت: "Marfat",
  نانسي: "Nancy", نوال: "Nawal", هيام: "Hayam", ولاء: "Walaa", يارا: "Yara", جنى: "Jana", روان: "Rawan", رودينا: "Rodina", سلوى: "Salwa", فيروز: "Fayrouz",
  بسام: "Bassam", وحيد: "Waheed", حسام: "Hossam", أشرف: "Ashraf", نورهان: "Nourhan", ربيع: "Rabie", بدر: "Badr", سليم: "Selim", توفيق: "Tawfik", فهيم: "Fahim",
  أمير: "Amir", ناجي: "Nagy", حجازي: "Hegazy", سماح: "Samah", منال: "Manal", بدوي: "Badawy", رضوى: "Radwa", شاهين: "Shaheen", عوف: "Awf", جاد: "Gad", صفوت: "Safwat",
  الرحمن: "Rahman", العزيز: "Aziz", الفتاح: "Fattah", الحميد: "Hamid", السلام: "Salam", المنعم: "Moneim", الرحيم: "Rahim", الكريم: "Karim", الستار: "Sattar", القادر: "Kader",
  عبادة: "Ebada", الوالد: "Father", الوالدة: "Mother", الاخ: "Brother", الاخت: "Sister", الجد: "Grandfather", الجدة: "Grandmother", الزوج: "Husband", الزوجة: "Wife", الابن: "Son", الابنة: "Daughter", العم: "Uncle", الخال: "Uncle", العمة: "Aunt", الخالة: "Aunt",
  // ألقاب وعائلات شائعة
  الدين: "El Din", الله: "Allah", الشريف: "El Sherif", الشافعي: "El Shafei", النجار: "El Naggar", عبد: "Abdel", ابو: "Abou", أبو: "Abou", بن: "Ben",
  عادل_: "Adel", عصمت: "Esmat", عرفة: "Arafa", عطية: "Attia", عفيفي: "Afifi", عيسى: "Eissa", غنيم: "Ghoneim", فرج: "Farag", قنديل: "Kandil", مبارك: "Mubarak",
  مغاوري: "Maghawry", نجيب: "Naguib", نصار: "Nassar", هلالي: "Helaly", ياقوت: "Yakout", خليل: "Khalil", جابر: "Gaber", حافظ: "Hafez", رضا: "Reda", رشدي: "Roshdy",
  زكي: "Zaki", سالم: "Salem", سلامة: "Salama", شحاتة: "Shehata", شوقي: "Shawky", صادق: "Sadek", عابد: "Abed", عامر: "Amer", عباس: "Abbas", عبده: "Abdo",
};
const NAMES: Record<string, string> = {};
for (const [k, v] of Object.entries(NAMES_RAW)) NAMES[norm(k.replace(/_/g, ""))] = v;

const LETTERS: Record<string, string> = {
  ا: "a", ب: "b", ت: "t", ث: "th", ج: "g", ح: "h", خ: "kh", د: "d", ذ: "z", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z",
  ع: "a", غ: "gh", ف: "f", ق: "k", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", و: "o", ي: "i", ء: "", ئ: "e", ؤ: "o", ى: "a", ة: "a",
};
const CONSONANT = /[بتثجحخدذرزسشصضطظغفقكلمنه]/; // ع مش هنا: بتتكتب a لوحدها فمفيش داعي نحط a بعدها

// قواعد حروف مبسّطة: بتحط "a" بين الحروف الساكنة المتتالية عشان الاسم يتنطق. جودتها أقل من القاموس.
function letters(word: string): string {
  const w = norm(word);
  let out = "";
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    out += c === "و" && /[ايا]/.test(w[i + 1] ?? "") ? "w" : (LETTERS[c] ?? c);
    if (CONSONANT.test(c) && i + 1 < w.length && (CONSONANT.test(w[i + 1]) || w[i + 1] === "ع")) out += "a";
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function wordEn(word: string): string {
  const n = norm(word);
  if (NAMES[n]) return NAMES[n];
  // عبد + اسم متصل ("عبدالسلام")
  const abd = n.match(/^عبد(.{2,})$/);
  if (abd) {
    const bare = abd[1].replace(/^ال/, "");
    const en = NAMES[norm(bare)] ?? letters(bare);
    return "Abdel" + en.charAt(0).toLowerCase() + en.slice(1);
  }
  // ال التعريف + اسم معروف
  if (n.startsWith("ال") && n.length > 3) {
    const rest = n.slice(2);
    return "El " + (NAMES[rest] ?? letters(rest));
  }
  return letters(word);
}

// الاسم بالكامل (كلمات مفصولة بمسافة). "د." و"دكتور" بتتشال هنا لأن التطبيق بيترجمها لـ Dr. لوحده.
export function transliterateName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(wordEn)
    .join(" ");
}
