#!/usr/bin/env node
// توليد أيقونات ملاذ بهوية الموقع (درع ذهبي + خط Cairo) عبر Chromium
const { chromium } = require("playwright");
const path = require("path");

const cairoBold = path.resolve(
  __dirname,
  "../node_modules/@expo-google-fonts/cairo/900Black/Cairo_900Black.ttf"
);

function pageHtml({ size, withBg, scale, tagline }) {
  return `<!DOCTYPE html><html><head><style>
  @font-face { font-family: 'Cairo'; src: url('file://${cairoBold}'); }
  * { margin:0; padding:0; }
  body { width:${size}px; height:${size}px; ${withBg ? "background:#1C2B2A;" : "background:transparent;"} display:flex; align-items:center; justify-content:center; }
  .wrap { display:flex; flex-direction:column; align-items:center; transform: scale(${scale}); }
  .name { font-family:'Cairo'; font-weight:900; font-size:200px; color:#C9A84C; line-height:1.05; margin-top:8px; }
  .en { font-family:'Cairo'; font-size:44px; letter-spacing:26px; color:rgba(201,168,76,.75); margin-top:6px; margin-right:-26px; }
  </style></head><body>
  <div class="wrap">
    <svg width="430" height="430" viewBox="0 0 100 100">
      <path d="M50 12 L84 34 L84 72 Q84 80 76 80 L24 80 Q16 80 16 72 L16 34 Z"
        fill="none" stroke="#C9A84C" stroke-width="6.5" stroke-linejoin="round"/>
      <rect x="44" y="36" width="12" height="34" rx="3.5" fill="#C9A84C"/>
      <rect x="33" y="47" width="34" height="12" rx="3.5" fill="#C9A84C"/>
    </svg>
    <div class="name">ملاذ</div>
    ${tagline ? '<div class="en">MALAAZ</div>' : ""}
  </div>
  </body></html>`;
}

async function shoot(browser, file, opts) {
  const page = await browser.newPage({ viewport: { width: opts.size, height: opts.size } });
  await page.setContent(pageHtml(opts));
  await page.waitForTimeout(400);
  await page.screenshot({
    path: file,
    omitBackground: !opts.withBg,
  });
  await page.close();
  console.log("✓", file);
}

(async () => {
  const browser = await chromium.launch();
  const out = path.resolve(__dirname, "../assets/images");
  // الأيقونة الرئيسية (iOS وعامة) — خلفية داكنة كاملة
  await shoot(browser, `${out}/icon.png`, { size: 1024, withBg: true, scale: 1.0, tagline: true });
  // الأندرويد adaptive — شفافة والمحتوى جوة منطقة الأمان (النظام بيقصها دايرة)
  await shoot(browser, `${out}/adaptive-icon.png`, { size: 1024, withBg: false, scale: 0.62, tagline: false });
  // السبلاش — شفافة بحجم مريح فوق الخلفية الداكنة
  await shoot(browser, `${out}/splash-icon.png`, { size: 1024, withBg: false, scale: 0.8, tagline: true });
  await browser.close();
})();
