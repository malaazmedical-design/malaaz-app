#!/usr/bin/env python3
"""Builds the merged admin from the real admin.html (src/admin.original.html) + admin-revoice.js.
Outputs dist/test (points at the TEST Supabase project, red banner) and dist/prod (points at the original project).
Only ADDS: 4 nav buttons, 4 page containers, 2 registrations, 1 script tag. Nothing existing is removed or edited."""
import pathlib, re, shutil
HERE = pathlib.Path(__file__).resolve().parent
orig = (HERE / "src" / "admin.original.html").read_text(encoding="utf8")
test_src = (HERE.parent / "admin-test" / "index.html").read_text(encoding="utf8")
TEST_URL = re.search(r'SUPABASE_URL = "([^"]+)"', test_src).group(1)
TEST_KEY = re.search(r'SUPABASE_ANON = "([^"]+)"', test_src).group(1)

def once(s, a, b):
    assert s.count(a) == 1, f"anchor not found exactly once: {a[:60]!r} ({s.count(a)})"
    return s.replace(a, b)

NAV = """    <div class="nav-section">الاستشارات الأونلاين</div>
    <div class="nav-item" onclick="showPage('rv-consults')"><i class="fas fa-video"></i><span>الاستشارات</span></div>
    <div class="nav-item" onclick="showPage('rv-asks')"><i class="fas fa-comment-medical"></i><span>أسئلة المرضى</span></div>
    <div class="nav-item" onclick="showPage('rv-sources')"><i class="fas fa-chart-line"></i><span>مصدر التثبيت</span></div>
    <div class="nav-item" onclick="showPage('rv-names')"><i class="fas fa-language"></i><span>الأسماء بالإنجليزي</span></div>

"""
PAGES = "".join(f'<div class="page" id="page-rv-{n}"><div id="rv-body-{n}"></div></div>\n\n' for n in ("consults", "asks", "sources", "names"))

def patch(s):
    s = once(s, '    <div class="nav-section">إدارة الخدمات</div>', NAV + '    <div class="nav-section">إدارة الخدمات</div>')
    s = once(s, '<!-- ======= NOTIFICATIONS PAGE ======= -->', "<!-- ======= REVOICE PAGES (admin-revoice.js) ======= -->\n" + PAGES + '<!-- ======= NOTIFICATIONS PAGE ======= -->')
    s = once(s, "  clients:'العملاء'\n};", "  clients:'العملاء',\n  'rv-consults':'الاستشارات الأونلاين', 'rv-asks':'أسئلة المرضى', 'rv-sources':'مصدر التثبيت', 'rv-names':'الأسماء بالإنجليزي'\n};")
    s = once(s, "    clients: loadClients\n  };", "    clients: loadClients,\n    'rv-consults': () => window.RV && RV.load('consults'), 'rv-asks': () => window.RV && RV.load('asks'),\n    'rv-sources': () => window.RV && RV.load('sources'), 'rv-names': () => window.RV && RV.load('names')\n  };")
    s = once(s, "</body>", '<script src="admin-revoice.js"></script>\n</body>')
    return s

merged = patch(orig)
out = HERE / "dist"
if out.exists(): shutil.rmtree(out)
for variant in ("test", "prod"):
    d = out / variant; d.mkdir(parents=True)
    page = merged
    if variant == "test":
        m_url = re.search(r'const SUPABASE_URL = "[^"]+";', page).group(0)
        m_key = re.search(r'const SUPABASE_KEY = "[^"]+";', page).group(0)
        page = page.replace(m_url, f'const SUPABASE_URL = "{TEST_URL}";').replace(m_key, f'const SUPABASE_KEY = "{TEST_KEY}";')
        # any other hard-coded call to the original project (e.g. the broadcast-push function) must NOT run from the test page
        page = page.replace("https://omsictbrqlsohrmxeuym.supabase.co", TEST_URL)
        page = once(page, "<body>", '<body>\n<div style="background:#c62828;color:#fff;text-align:center;padding:6px;font:700 13px sans-serif;position:sticky;top:0;z-index:99999">نسخة اختبار — مشروع التست فقط (malaaz-mizo-test)</div>')
    else:
        (d / "admin-legacy.html").write_text(orig, encoding="utf8")  # fallback: the page exactly as it is today
    (d / "admin.html").write_text(page, encoding="utf8")
    shutil.copy(HERE / "admin-revoice.js", d / "admin-revoice.js")
print("built:", [str(p.relative_to(HERE)) for p in sorted(out.rglob("*")) if p.is_file()])
