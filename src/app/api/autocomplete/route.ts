import { NextRequest } from 'next/server';

// Simple in-memory cache and rate limiter (per process)
const cache = new Map<string, { t: number; data: any }>();
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX = 60; // 60 requests/minute per IP
const hits = new Map<string, { start: number; count: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  if (now - entry.start > RATE_WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  if (entry.count > RATE_MAX) return true;
  return false;
}

async function fetchGeoapify(q: string, apiKey?: string) {
  if (!apiKey) throw new Error('Missing GEOAPIFY_KEY');
  const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}&limit=7&format=json&apiKey=${apiKey}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (res.status === 429) {
    throw Object.assign(new Error('Geoapify rate limit'), { code: 429 });
  }
  if (!res.ok) throw new Error(`Geoapify failed: ${res.status}`);
  const data = await res.json();
  const items = (data?.results || data?.features || data?.results || []) as any[];
  const suggestions = items
    .map((it: any) => ({
      label: it.formatted || it.result || it.display_name || [it.address_line1, it.address_line2].filter(Boolean).join(', '),
      lat: it.lat ?? it.geometry?.coordinates?.[1],
      lon: it.lon ?? it.geometry?.coordinates?.[0],
    }))
    .filter((s) => s.label && s.lat != null && s.lon != null);
  return { suggestions };
}

async function fetchLocationIQ(q: string, apiKey?: string) {
  if (!apiKey) throw new Error('Missing LOCATIONIQ_KEY');
  const url = `https://us1.locationiq.com/v1/autocomplete?key=${apiKey}&q=${encodeURIComponent(q)}&limit=7&tag=place,address`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`LocationIQ failed: ${res.status}`);
  const data = await res.json();
  const suggestions = (Array.isArray(data) ? data : [])
    .map((it: any) => ({
      label: it?.display_place ? `${it.display_place}, ${it.display_address}` : it?.display_name,
      lat: it?.lat ? Number(it.lat) : undefined,
      lon: it?.lon ? Number(it.lon) : undefined,
    }))
    .filter((s) => s.label && s.lat != null && s.lon != null);
  return { suggestions };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    if (!q) {
      return new Response(JSON.stringify({ suggestions: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'anon';
    if (rateLimited(String(ip))) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }

    const cacheKey = `ap:${q.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.t < 5 * 60_000) {
      return new Response(JSON.stringify(cached.data), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
    }

    const geoKey = process.env.GEOAPIFY_KEY;
    const locIqKey = process.env.LOCATIONIQ_KEY;

    let payload;
    try {
      payload = await fetchGeoapify(q, geoKey);
    } catch (e: any) {
      if (e?.code === 429) {
        // fallback to LocationIQ on Geoapify rate limit
        payload = await fetchLocationIQ(q, locIqKey);
      } else {
        // try fallback anyway
        try {
          payload = await fetchLocationIQ(q, locIqKey);
        } catch (e2) {
          throw e;
        }
      }
    }

    cache.set(cacheKey, { t: Date.now(), data: payload });
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Autocomplete error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
