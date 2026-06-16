#!/usr/bin/env node
// توليد أيقونات ملاذ — اللوجو الرسمي: "ملاذ" + MALAAZ بخط Cairo (من غير رموز)
const { chromium } = require("playwright");
const path = require("path");

const cairoBlack = path.resolve(
  __dirname,
  "../node_modules/@expo-google-fonts/cairo/900Black/Cairo_900Black.ttf"
);

function pageHtml({ size, withBg, scale }) {
  return `<!DOCTYPE html><html><head><style>
  @font-face { font-family: 'Cairo'; src: url('file://${cairoBlack}'); }
  * { margin:0; padding:0; }
  body { width:${size}px; height:${size}px; ${withBg ? "background:#1C2B2A;" : "background:transparent;"} display:flex; align-items:center; justify-content:center; }
  .wrap { display:flex; flex-direction:column; align-items:center; transform: scale(${scale}); }
  .name { font-family:'Cairo'; font-weight:900; font-size:430px; color:#C9A84C; line-height:1; }
  .en { font-family:'Cairo'; font-weight:900; font-size:64px; letter-spacing:46px; color:rgba(201,168,76,.8); margin-top:-20px; margin-right:-46px; }
  </style></head><body>
  <div class="wrap">
    <div class="name">ملاذ</div>
    <div class="en">MALAAZ</div>
  </div>
  </body></html>`;
}

async function shoot(browser, file, opts) {
  const page = await browser.newPage({ viewport: { width: opts.size, height: opts.size } });
  await page.setContent(pageHtml(opts));
  await page.waitForTimeout(400);
  await page.screenshot({ path: file, omitBackground: !opts.withBg });
  await page.close();
  console.log("✓", file);
}

(async () => {
  const browser = await chromium.launch();
  const out = path.resolve(__dirname, "../assets/images");
  // الأيقونة الرئيسية — خلفية داكنة كاملة
  await shoot(browser, `${out}/icon.png`, { size: 1024, withBg: true, scale: 1.0 });
  // الأندرويد adaptive — شفافة والمحتوى جوة منطقة الأمان
  await shoot(browser, `${out}/adaptive-icon.png`, { size: 1024, withBg: false, scale: 0.6 });
  // السبلاش
  await shoot(browser, `${out}/splash-icon.png`, { size: 1024, withBg: false, scale: 0.85 });
  await browser.close();
})();
