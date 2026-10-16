// لقطة البيانات العامة (المقدمين، التقييمات، التخصصات، المناطق، المثبّتين) → ملف JSON في bucket عام يتخدم من الـCDN.
// بتتنادى من pg_cron كل دقيقتين (سطر cron في 10_public_snapshot.sql). مفيش فيها بيانات حساسة: الأعمدة محددة في build_public_snapshot().
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const BUCKET = "public-snapshots";
const FILE = "providers.json";
const MIN_GAP_MS = 30_000; // لو اللقطة اتبنت من أقل من 30 ثانية مش بنبنيها تاني (حماية من النداء الكتير)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async () => {
  try {
    const { data: files } = await supabase.storage.from(BUCKET).list("", { search: FILE, limit: 1 });
    const last = files?.find((f) => f.name === FILE)?.updated_at;
    if (last && Date.now() - new Date(last).getTime() < MIN_GAP_MS) return json({ ok: true, skipped: "fresh" });

    const { data, error } = await supabase.rpc("build_public_snapshot");
    if (error) return json({ ok: false, error: error.message }, 500);

    const body = JSON.stringify(data);
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(FILE, body, { upsert: true, contentType: "application/json", cacheControl: "60" });
    if (upErr) return json({ ok: false, error: upErr.message }, 500);
    return json({ ok: true, bytes: body.length });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
