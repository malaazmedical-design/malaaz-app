// يضغّط صور المقدمين الموجودة في bucket "provider-photos" (مرة واحدة).
// - بياخد نسخة احتياطية من كل صورة أصلية في مجلد backup-provider-photos قبل ما يغيّر أي حاجة.
// - بيرفع الصورة المضغوطة بنفس الاسم، فالروابط في قاعدة البيانات ما بتتغيرش.
// - الافتراضي "تجربة" (dry run): بيطبع بس اللي هيحصل من غير ما يرفع حاجة. للتنفيذ الفعلي: --apply
//
// التشغيل (PowerShell):
//   npm init -y
//   npm i @supabase/supabase-js sharp
//   $env:SUPABASE_URL="https://omsictbrqlsohrmxeuym.supabase.co"
//   $env:SUPABASE_SERVICE_KEY="<service_role key>"
//   node compress-provider-photos.mjs            # تجربة
//   node compress-provider-photos.mjs --apply    # تنفيذ
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = "provider-photos";
const APPLY = process.argv.includes("--apply");
const MIN_BYTES = 150 * 1024; // الصور الأصغر من كده بنسيبها
const MAX_SIDE = 800;
const BACKUP_DIR = "backup-provider-photos";

if (!URL_ || !KEY) {
  console.error("لازم تحدد SUPABASE_URL و SUPABASE_SERVICE_KEY");
  process.exit(1);
}
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
const kb = (n) => (n / 1024).toFixed(0) + " KB";

async function listAll() {
  const files = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await sb.storage.from(BUCKET).list("", { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    if (!data?.length) break;
    files.push(...data.filter((f) => f.id)); // المجلدات ملهاش id
    if (data.length < 100) break;
  }
  return files;
}

async function compress(buf) {
  return sharp(buf)
    .rotate() // يحترم اتجاه الصورة
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 75, mozjpeg: true })
    .toBuffer();
}

const files = await listAll();
console.log(`لقيت ${files.length} ملف في ${BUCKET} — ${APPLY ? "تنفيذ فعلي" : "تجربة (من غير رفع)"}\n`);
if (APPLY) fs.mkdirSync(BACKUP_DIR, { recursive: true });

let before = 0, after = 0, changed = 0, skipped = 0, failed = 0;
for (const f of files) {
  const size = f.metadata?.size ?? 0;
  before += size;
  if (size < MIN_BYTES) { after += size; skipped++; continue; }
  try {
    const { data: blob, error } = await sb.storage.from(BUCKET).download(f.name);
    if (error) throw error;
    const orig = Buffer.from(await blob.arrayBuffer());
    const small = await compress(orig);
    if (small.length >= orig.length) { after += size; skipped++; console.log(`= ${f.name}: مفيش فايدة (${kb(orig.length)}) — سيبتها`); continue; }
    console.log(`${APPLY ? "✔" : "→"} ${f.name}: ${kb(orig.length)} ← ${kb(small.length)}`);
    after += small.length; changed++;
    if (APPLY) {
      fs.writeFileSync(path.join(BACKUP_DIR, f.name), orig); // نسخة احتياطية الأول
      const { error: upErr } = await sb.storage.from(BUCKET).upload(f.name, small, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
      if (upErr) throw upErr;
    }
  } catch (e) {
    failed++; after += size;
    console.error(`✖ ${f.name}: ${e.message ?? e}`);
  }
}
console.log(`\nالإجمالي: ${kb(before)} ← ${kb(after)} | اتغيّر ${changed} | اتسابت ${skipped} | فشل ${failed}`);
if (!APPLY) console.log("ده كان تجربة بس. شغّله بـ --apply للتنفيذ.");
else console.log(`النسخ الأصلية محفوظة في ./${BACKUP_DIR}`);
