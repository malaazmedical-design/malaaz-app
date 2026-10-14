// Creates / deletes a cloned voice at the TTS provider. The provider API key
// lives only here (supabase secrets set ELEVENLABS_API_KEY=...).
// Provider is ElevenLabs Instant Voice Cloning; swap the two fetch calls to
// change provider — the app only ever sees an opaque `voice_id`.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_BYTES = 10 * 1024 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) return json({ error: "Voice provider not configured" }, 503);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  if (body.action === "delete") {
    if (!body.voice_id) return json({ error: "voice_id required" }, 400);
    const r = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(body.voice_id)}`, {
      method: "DELETE", headers: { "xi-api-key": apiKey },
    });
    return json({ ok: r.ok }, r.ok ? 200 : 502);
  }

  if (body.action !== "create") return json({ error: "Unknown action" }, 400);
  if (!body.audio_base64 || !body.name) return json({ error: "name and audio_base64 required" }, 400);

  const bytes = Uint8Array.from(atob(body.audio_base64), (c) => c.charCodeAt(0));
  if (bytes.byteLength > MAX_BYTES) return json({ error: "Sample too large" }, 413);

  const form = new FormData();
  form.append("name", String(body.name).slice(0, 100));
  form.append("remove_background_noise", "true");
  form.append("files", new Blob([bytes], { type: body.mime ?? "audio/mp4" }), body.filename ?? "sample.m4a");

  const r = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST", headers: { "xi-api-key": apiKey }, body: form,
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok || !out.voice_id) {
    return json({ error: out?.detail?.message ?? `Provider error ${r.status}` }, 502);
  }
  return json({ voice_id: out.voice_id });
});
