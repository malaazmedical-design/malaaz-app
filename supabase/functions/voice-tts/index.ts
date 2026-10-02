// Speaks a phrase with a cloned voice. Returns mp3 bytes.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) return new Response("Voice provider not configured", { status: 503, headers: CORS });

  let body: any;
  try { body = await req.json(); } catch { return new Response("Invalid JSON", { status: 400, headers: CORS }); }
  const { voice_id, phrase } = body ?? {};
  if (!voice_id || !phrase || String(phrase).length > 300) {
    return new Response("voice_id and phrase (<=300 chars) required", { status: 400, headers: CORS });
  }

  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice_id)}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text: phrase,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.85 },
    }),
  });
  if (!r.ok) return new Response(`Provider error ${r.status}`, { status: 502, headers: CORS });
  return new Response(r.body, { headers: { ...CORS, "Content-Type": "audio/mpeg" } });
});
