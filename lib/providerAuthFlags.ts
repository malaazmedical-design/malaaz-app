// Flags shared by the provider and client auth flows (the app has ONE Supabase session, so the client
// side must know when the session belongs to a provider login / a provider sign-up in progress).
export const GOOGLE_INTENT = "malaz.provider.googleIntent"; // provider tapped "continue with Google"
export const PROVIDER_SIGNUP = "malaz.provider.signupInProgress"; // Google session without a providers row yet
