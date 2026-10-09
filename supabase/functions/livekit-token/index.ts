// Supabase Edge Function: livekit-token
// Issues a short-lived LiveKit room token to the client or the doctor of a LIVE voice/video consultation.
// The LiveKit API secret lives only in this function's secrets — it never reaches a phone.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   LIVEKIT_URL         wss://<project>.livekit.cloud
//   LIVEKIT_API_KEY     the API key
//   LIVEKIT_API_SECRET  the API secret
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase automatically.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const enc = new TextEncoder();
const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === "string" ? enc.encode(data) : new Uint8Array(data);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// HS256 JWT signed with the LiveKit API secret (no external library)
async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);
    const { consultation_id } = await req.json();
    if (!consultation_id) return json({ error: "missing_consultation" }, 400);

    // runs as the caller: roles / RLS decide whether they belong to this consultation
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data, error } = await sb.rpc("consult_call_access", { p_id: consultation_id });
    if (error) return json({ error: "lookup_failed" }, 500);
    const access = Array.isArray(data) ? data[0] : data;
    if (!access) return json({ error: "forbidden" }, 403);
    if (access.channel !== "voice" && access.channel !== "video") return json({ error: "not_a_call" }, 400);
    if (access.state !== "live" || !access.ends_at) return json({ error: "not_live" }, 409);
    // monthly free credit used up -> the app falls back to chat (the chat room is always open)
    if (!access.rtc_ok) return json({ error: "rtc_unavailable" }, 503);

    const remaining = Math.floor((new Date(access.ends_at).getTime() - Date.now()) / 1000);
    if (remaining <= 0) return json({ error: "ended" }, 409);

    const url = Deno.env.get("LIVEKIT_URL")!;
    const apiKey = Deno.env.get("LIVEKIT_API_KEY")!;
    const secret = Deno.env.get("LIVEKIT_API_SECRET")!;
    if (!url || !apiKey || !secret) return json({ error: "server_not_configured" }, 500);

    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt(
      {
        iss: apiKey,
        sub: `${access.role}:${consultation_id}`, // one identity per side: a rejoin replaces the old connection
        name: access.display_name,
        nbf: now - 5,
        exp: now + remaining + 120, // valid for the session; after a doctor extension the app fetches a fresh token on reconnect
        video: {
          roomJoin: true,
          room: consultation_id,
          canSubscribe: true,
          canPublish: true,
          canPublishData: false, // chat goes through Supabase, nothing else is exchanged
          canPublishSources: access.channel === "video" ? ["microphone", "camera"] : ["microphone"],
        },
      },
      secret,
    );
    return json({ url, token, channel: access.channel, role: access.role });
  } catch (e) {
    return json({ error: "server_error", detail: String(e) }, 500);
  }
});
