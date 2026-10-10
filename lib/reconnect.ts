import { useEffect } from "react";

// Fired once when the connection comes back (offline -> online) or the app returns to the foreground after a failed load.
const subs = new Set<() => void>();
export const emitReconnect = () => subs.forEach((f) => { try { f(); } catch {} });

// Run `fn` every time the connection comes back (screens use it to reload their data without restarting the app)
export function useOnReconnect(fn: () => void) {
  useEffect(() => {
    subs.add(fn);
    return () => { subs.delete(fn); };
  }, [fn]);
}
