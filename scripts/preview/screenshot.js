#!/usr/bin/env node
// بيصوّر شاشات التطبيق من نسخة الويب — مع mock لـ Supabase لأن شبكة البيئة محجوبة
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = "http://127.0.0.1:8097";
const OUT = "/tmp/malaaz-shots";
const providers = fs.readFileSync(path.join(__dirname, "providers.json"), "utf8");
const placeholderPng = fs.readFileSync(
  path.join(__dirname, "..", "..", "assets", "images", "provider1.png")
);

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  // Mock كل نداءات Supabase
  await page.route("**/*supabase.co/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes("/rest/v1/providers")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: providers,
      });
    }
    if (url.includes("/rest/v1/bookings") && method === "POST") {
      return route.fulfill({ status: 201, contentType: "application/json", body: "" });
    }
    if (url.includes("/rest/v1/bookings")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    if (url.includes("/rest/v1/reviews") && method === "POST") {
      return route.fulfill({ status: 201, contentType: "application/json", body: "" });
    }
    if (url.includes("/storage/")) {
      return route.fulfill({ status: 200, contentType: "image/png", body: placeholderPng });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  const shot = async (name) => {
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log("captured:", name);
  };

  // الرئيسية
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await shot("01-home");

  // الرئيسية بعد سكرول لقائمة المقدمين
  await page.mouse.wheel(0, 900);
  await shot("02-home-providers");

  // الطلب السريع
  await page.goto(BASE + "/quick-request", { waitUntil: "networkidle" });
  await shot("03-quick-request");

  // صفحة مقدم خدمة
  await page.goto(BASE + "/provider/8bde91e3-8dba-4594-b72e-670bb08e877f", {
    waitUntil: "networkidle",
  });
  await shot("04-provider");

  // الحجوزات
  await page.goto(BASE + "/bookings", { waitUntil: "networkidle" });
  await shot("05-bookings");

  // البروفايل
  await page.goto(BASE + "/profile", { waitUntil: "networkidle" });
  await shot("06-profile");

  // بوابة مقدم الخدمة — تسجيل الدخول
  await page.goto(BASE + "/provider-portal/login", { waitUntil: "networkidle" });
  await shot("07-provider-login");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
