"use client"

import { PostHogProvider as PHProvider } from "posthog-js/react"
import { useEffect, useState } from "react"

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<any | null>(null);

  useEffect(() => {
    // Only initialize PostHog in production
    if (process.env.NODE_ENV === 'development') return;
    
    const idle = (cb: () => void) => {
      if (typeof (window as any).requestIdleCallback === 'function') (window as any).requestIdleCallback(cb);
      else setTimeout(cb, 1500);
    };
    idle(async () => {
      try {
        const mod = await import('posthog-js');
        const posthog = mod.default;
        posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
          api_host: "https://us.i.posthog.com",
          ui_host: "https://us.posthog.com",
          defaults: '2025-05-24',
          capture_exceptions: true,
          debug: false,
        });
        // Expose on window for safe access
        (window as any).posthog = posthog;
        setClient(posthog);
      } catch {}
    });
  }, [])

  if (!client) return <>{children}</>;
  return <PHProvider client={client}>{children}</PHProvider>
}
