# livekit-token (Edge Function)

Gives the client or the doctor of a LIVE voice/video consultation a short-lived LiveKit room token.
The LiveKit API secret exists only here (Supabase secrets); it never reaches a phone.

## Deploy (dashboard, no CLI)
1. Supabase → **Edge Functions** → **Deploy a new function** → name it exactly `livekit-token`.
2. Paste the content of `index.ts` and deploy. Keep "Verify JWT" ON (default).
3. Edge Functions → **Secrets** → add:
   - `LIVEKIT_URL` = `wss://<your-project>.livekit.cloud`
   - `LIVEKIT_API_KEY` = the key
   - `LIVEKIT_API_SECRET` = the secret (never paste it in chat or in git)

## What it checks (server side)
- caller is logged in and is the client or the doctor of that consultation (`consult_call_access`)
- the consultation is `live` and its channel is `voice` / `video`
- the monthly LiveKit free credit is not used up (otherwise the app falls back to chat)
- token lives only until the session ends; publishing is limited to mic (+ camera for video); no data channel, no recording
