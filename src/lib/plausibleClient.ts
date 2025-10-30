// Lightweight wrapper to send custom events to Plausible when the script is loaded.
export function trackEvent(name: string, props?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  try {
    const p = (window as any).plausible;
    if (p) {
      if (props && Object.keys(props).length > 0) {
        p(name, { props });
      } else {
        p(name);
      }
    }
  } catch (e) {
    // Silently fail to avoid breaking the UI
  }
}

export default trackEvent;
