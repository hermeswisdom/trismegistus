import { useSyncExternalStore } from "react";

const subscribeToNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * `false` on the server AND during the client's hydration render, `true` from
 * the next render on (and immediately for components mounted after hydration).
 *
 * Gate client-only state (session, localStorage, …) behind this so the first
 * client render is byte-identical to the SSR HTML — otherwise React throws
 * hydration error #418 and re-renders the whole root on the client.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeToNothing, onClient, onServer);
}
