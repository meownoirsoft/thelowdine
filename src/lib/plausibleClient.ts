// Lightweight wrapper to send custom events to Plausible when the script is loaded.
export function trackEvent(name: string, props?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  try {
    const p = (window as any).plausible;
    if (p) {
      if (props && Object.keys(props).length > 0) {
        console.log('[Plausible] Tracking event:', name, 'with props:', props);
        p(name, { props });
      } else {
        console.log('[Plausible] Tracking event:', name);
        p(name);
      }
    } else {
      console.warn('[Plausible] Script not loaded yet, cannot track:', name);
    }
  } catch (e) {
    console.error('[Plausible] Error tracking event:', name, e);
  }
}

export default trackEvent;
