#!/usr/bin/env node
// توليد أصول صفحة Google Play: أيقونة 512 + غلاف 1024x500 + سكرين شوتس 1080x1920
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const cairoBlack = path.resolve(__dirname, "../node_modules/@expo-google-fonts/cairo/900Black/Cairo_900Black.ttf");
const cairoBold = path.resolve(__dirname, "../node_modules/@expo-google-fonts/cairo/700Bold/Cairo_700Bold.ttf");
const OUT = "/tmp/play-assets";
const BASE = process.env.BASE || "http://127.0.0.1:8110";

const providers = fs.readFileSync(path.join(__dirname, "preview/providers.json"), "utf8");
const placeholderPng = fs.readFileSync(path.join(__dirname, "../assets/images/provider1.png"));
const subs = JSON.stringify([
  { id: "1", service_name: "كشف منزلي", group_name: "specialty", name: "أطفال", duration: "30-45 دقيقة", price_min: 1000, price_max: 1700, price_min_specialist: 1000, price_max_specialist: 1400, price_min_consultant: 1300, price_max_consultant: 1700, is_active: true },
  { id: "2", service_name: "كشف منزلي", group_name: "specialty", name: "مخ وأعصاب", duration: "30-45 دقيقة", price_min: 1100, price_max: 1800, price_min_specialist: 1100, price_max_specialist: 1500, price_min_consultant: 1400, price_max_consultant: 1800, is_active: true },
  { id: "3", service_name: "كشف منزلي", group_name: "specialty", name: "قلب وأوعية دموية", duration: "30-45 دقيقة", price_min: 1200, price_max: 1900, price_min_specialist: 1200, price_max_specialist: 1600, price_min_consultant: 1500, price_max_consultant: 1900, is_active: true },
  { id: "4", service_name: "كشف منزلي", group_name: "specialty", name: "عظام", duration: "30 دقيقة", price_min: 1000, price_max: 1600, price_min_specialist: 1000, price_max_specialist: 1300, price_min_consultant: 1300, price_max_consultant: 1600, is_active: true },
  { id: "5", service_name: "كشف منزلي", group_name: "specialty", name: "نساء وتوليد", duration: "30-45 دقيقة", price_min: 1100, price_max: 1700, price_min_specialist: 1100, price_max_specialist: 1400, price_min_consultant: 1400, price_max_consultant: 1700, is_active: true },
  { id: "6", service_name: "كشف منزلي", group_name: "specialty", name: "باطنة", duration: "30-45 دقيقة", price_min: 1000, price_max: 1600, price_min_specialist: 1000, price_max_specialist: 1300, price_min_consultant: 1300, price_max_consultant: 1600, is_active: true },
]);

async function mockRoutes(page) {
  await page.route("**/*supabase.co/**", (route) => {
    const url = route.request().url();
    if (url.includes("/rest/v1/providers")) return route.fulfill({ status: 200, contentType: "application/json", body: providers });
    if (url.includes("/rest/v1/sub_services")) return route.fulfill({ status: 200, contentType: "application/json", body: subs });
    if (url.includes("/storage/")) return route.fulfill({ status: 200, contentType: "image/png", body: placeholderPng });
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // ─── 1) أيقونة المتجر 512×512 ───
  {
    const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
    await page.setContent(`<!DOCTYPE html><html><head><style>
      @font-face { font-family:'Cairo'; src:url('file://${cairoBlack}'); }
      *{margin:0;padding:0} body{width:512px;height:512px;background:#1C2B2A;display:flex;align-items:center;justify-content:center}
      .w{display:flex;flex-direction:column;align-items:center}
      .n{font-family:'Cairo';font-weight:900;font-size:215px;color:#C9A84C;line-height:1}
      .e{font-family:'Cairo';font-weight:900;font-size:32px;letter-spacing:23px;color:rgba(201,168,76,.8);margin-top:-10px;margin-right:-23px}
    </style></head><body><div class="w"><div class="n">ملاذ</div><div class="e">MALAAZ</div></div></body></html>`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/icon-512.png` });
    await page.close();
    console.log("✓ icon-512");
  }

  // ─── 2) صورة الغلاف 1024×500 ───
  {
    const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
    await page.setContent(`<!DOCTYPE html><html><head><style>
      @font-face { font-family:'Cairo'; src:url('file://${cairoBlack}'); }
      @font-face { font-family:'CairoB'; src:url('file://${cairoBold}'); }
      *{margin:0;padding:0} body{width:1024px;height:500px;background:linear-gradient(135deg,#1C2B2A 0%,#243635 100%);display:flex;align-items:center;justify-content:center;overflow:hidden}
      .glow{position:absolute;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(201,168,76,.16),transparent 65%)}
      .w{display:flex;flex-direction:column;align-items:center;z-index:1}
      .n{font-family:'Cairo';font-weight:900;font-size:160px;color:#C9A84C;line-height:1.1}
      .e{font-family:'Cairo';font-weight:900;font-size:26px;letter-spacing:20px;color:rgba(201,168,76,.8);margin-right:-20px}
      .t{font-family:'CairoB';font-size:26px;color:rgba(255,255,255,.75);margin-top:16px}
      .line{width:130px;height:3px;background:#C9A84C;border-radius:3px;margin-top:18px}
    </style></head><body>
      <div class="glow"></div>
      <div class="w"><div class="n">ملاذ</div><div class="e">MALAAZ</div>
      <div class="line"></div>
      <div class="t">كشف وتمريض وأشعة في بيتك — القاهرة والجيزة</div></div>
    </body></html>`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/feature-graphic-1024x500.png` });
    await page.close();
    console.log("✓ feature graphic");
  }

  // ─── 3) سكرين شوتس 1080×1920 (مقاس المتجر) ───
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await mockRoutes(page);

  const shoot = async (name, wait = 2800) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log("✓", name);
  };

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await shoot("shot-1-home");

  await page.mouse.wheel(0, 800);
  await shoot("shot-2-providers", 1200);

  await page.goto(`${BASE}/quick-request`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.getByText("كشف منزلي", { exact: true }).first().click();
  await shoot("shot-3-specialties", 1500);

  await page.goto(`${BASE}/provider/8bde91e3-8dba-4594-b72e-670bb08e877f`, { waitUntil: "networkidle" });
  await shoot("shot-4-provider");

  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  await shoot("shot-5-profile");

  await page.goto(`${BASE}/provider-portal/login`, { waitUntil: "networkidle" });
  await shoot("shot-6-provider-portal");

  await browser.close();
  console.log("ALL DONE →", OUT);
})();
