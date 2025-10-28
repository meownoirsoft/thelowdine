import { NextRequest, NextResponse } from 'next/server';
import { setDefaultResultOrder } from 'node:dns';

// Ensure Node.js runtime for server-side fetch and DNS control
export const runtime = 'nodejs';

// Route config
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Simple in-memory cache to smooth over transient Overpass flakiness
const OVERPASS_CACHE = new Map<string, { ts: number; data: any }>();
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes
const CACHE_MAX = 300;

// Prefer IPv4 to avoid broken IPv6 DNS/resolution causing fetch failures
try {
  setDefaultResultOrder('ipv4first');
} catch {}

function cacheKey(lat: number, lon: number, radiusMeters: number, amenities: string[], opts?: any) {
  return `ov:${lat.toFixed(6)}:${lon.toFixed(6)}:${radiusMeters}:${amenities.join('|')}:${JSON.stringify(opts || {})}`;
}

function pruneCacheIfNeeded() {
  if (OVERPASS_CACHE.size <= CACHE_MAX) return;
  // remove oldest
  let oldestKey: string | null = null;
  let oldestTs = Infinity;
  for (const k of Array.from(OVERPASS_CACHE.keys())) {
    const v = OVERPASS_CACHE.get(k)!;
    if (v.ts < oldestTs) {
      oldestTs = v.ts;
      oldestKey = k;
    }
  }
  if (oldestKey) OVERPASS_CACHE.delete(oldestKey);
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; // miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function geocode(text: string) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', text);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Lowdine/1.0 (contact: example@example.com)'
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const item = data[0];
    return { lat: parseFloat(item.lat), lon: parseFloat(item.lon), display_name: item.display_name as string };
  } catch (e) {
    console.log('[API] geocode error', (e as any)?.message || String(e));
    return null;
  } finally {
    clearTimeout(to);
  }
}

async function overpassRestaurants(
  lat: number,
  lon: number,
  radiusMeters: number,
  amenities: string[],
  opts?: { includeCuisineRegex?: string; includeNameRegex?: string; excludeCuisineRegex?: string; excludeNameRegex?: string; diet?: 'vegan' | 'vegetarian' }
) {
  const am = amenities.join('|');
  const cuisineInclude = opts?.includeCuisineRegex ? ` [\"cuisine\"~\"(${opts.includeCuisineRegex})\", i]` : '';
  const cuisineExclude = opts?.excludeCuisineRegex ? ` [\"cuisine\"!~\"(${opts.excludeCuisineRegex})\", i]` : '';
  const nameInclude = opts?.includeNameRegex ? ` [\"name\"~\"(${opts.includeNameRegex})\", i]` : '';
  const nameExclude = opts?.excludeNameRegex ? ` [\"name\"!~\"(${opts.excludeNameRegex})\", i]` : '';
  const dietFilter = opts?.diet === 'vegan'
    ? ` [\"diet:vegan\"=\"yes\"]`
    : opts?.diet === 'vegetarian'
    ? ` [\"diet:vegetarian\"=\"yes\"]`
    : '';
  const common = `[\"amenity\"~\"^(${am})$\"]${cuisineInclude}${cuisineExclude}${nameInclude}${nameExclude}${dietFilter}`;
  const query = `
    [out:json][timeout:30];
    (
      node${common}(around:${radiusMeters},${lat},${lon});
      way${common}(around:${radiusMeters},${lat},${lon});
      relation${common}(around:${radiusMeters},${lat},${lon});
    );
    out center tags 80;
  `;
  console.log('[API] Overpass Query length', query.length);

  const endpoints = shuffle([
    'https://overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.nchc.org.tw/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter'
  ]);

  // Check cache first
  const key = cacheKey(lat, lon, radiusMeters, amenities, opts);
  const cached = OVERPASS_CACHE.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log('[API] overpassRestaurants: cache hit', { key, count: Array.isArray(cached.data) ? cached.data.length : 0 });
    return cached.data;
  }

  let data: any = null;
  for (const ep of endpoints) {
    // try each endpoint with a couple attempts and exponential backoff
    const attempts = 3;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const attemptStart = Date.now();
      try {
        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(), 30000);
        // First try POST (recommended)
        const res = await fetch(ep, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': 'Lowdine/1.0 (contact: example@example.com)'
          },
          body: new URLSearchParams({ data: query }).toString(),
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(to);

        const elapsed = Date.now() - attemptStart;
        if (!res.ok) {
          console.log('[API] overpass endpoint non-ok (POST)', { endpoint: ep, status: res.status, attempt, elapsed });
          // Try GET fallback immediately if POST fails
          const getUrl = `${ep}?data=${encodeURIComponent(query)}`;
          const controller2 = new AbortController();
          const to2 = setTimeout(() => controller2.abort(), 30000);
          try {
            const resGet = await fetch(getUrl, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Lowdine/1.0 (contact: example@example.com)'
              },
              cache: 'no-store',
              signal: controller2.signal,
            });
            clearTimeout(to2);
            if (resGet.ok) {
              const parsed = await resGet.json();
              if (parsed && Array.isArray(parsed.elements) && parsed.elements.length > 0) {
                console.log('[API] overpass endpoint success (GET)', { endpoint: ep, count: parsed.elements.length, attempt, elapsed });
                data = parsed;
                break;
              }
              console.log('[API] overpass endpoint ok but empty (GET)', { endpoint: ep, attempt, elapsed });
            } else {
              console.log('[API] overpass endpoint non-ok (GET)', { endpoint: ep, status: resGet.status, attempt, elapsed });
            }
          } catch (e2) {
            console.log('[API] overpass GET error', { endpoint: ep, attempt, error: (e2 as any)?.message, cause: (e2 as any)?.cause?.code });
          } finally {
            clearTimeout(to2);
          }
          if (data) break;
          if (attempt < attempts - 1) {
            const backoffTime = 500 * Math.pow(2, attempt);
            console.log(`[API] backing off for ${backoffTime}ms before retry`);
            await sleep(backoffTime);
          }
          continue;
        }

        const parsed = await res.json();
        if (parsed && Array.isArray(parsed.elements) && parsed.elements.length > 0) {
          console.log('[API] overpass endpoint success', { endpoint: ep, count: parsed.elements.length, attempt, elapsed });
          data = parsed;
          break;
        }

        console.log('[API] overpass endpoint ok but empty', { endpoint: ep, attempt, elapsed });
        if (attempt < attempts - 1) {
          const backoffTime = 500 * Math.pow(2, attempt);
          console.log(`[API] backing off for ${backoffTime}ms before retry`);
          await sleep(backoffTime);
        }
      } catch (e) {
        const msg = (e as any)?.message || String(e);
        const cause = (e as any)?.cause?.code || (e as any)?.code;
        console.log('[API] overpass endpoint error', { endpoint: ep, attempt, error: msg, cause });
        // Try GET fallback when fetch throws
        try {
          const getUrl = `${ep}?data=${encodeURIComponent(query)}`;
          const controller2 = new AbortController();
          const to2 = setTimeout(() => controller2.abort(), 30000);
          const resGet = await fetch(getUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Lowdine/1.0 (contact: example@example.com)'
            },
            cache: 'no-store',
            signal: controller2.signal,
          });
          clearTimeout(to2);
          if (resGet.ok) {
            const parsed = await resGet.json();
            if (parsed && Array.isArray(parsed.elements) && parsed.elements.length > 0) {
              console.log('[API] overpass endpoint success (GET-after-error)', { endpoint: ep, count: parsed.elements.length, attempt });
              data = parsed;
            } else {
              console.log('[API] overpass endpoint ok but empty (GET-after-error)', { endpoint: ep, attempt });
            }
          } else {
            console.log('[API] overpass endpoint non-ok (GET-after-error)', { endpoint: ep, status: resGet.status, attempt });
          }
        } catch (e2) {
          console.log('[API] overpass GET-after-error failed', { endpoint: ep, attempt, error: (e2 as any)?.message, cause: (e2 as any)?.cause?.code });
        }
        if (data) break;
        if (attempt < attempts - 1) {
          const backoffTime = 500 * Math.pow(2, attempt);
          console.log(`[API] backing off for ${backoffTime}ms before retry`);
          await sleep(backoffTime);
        }
      }
      if (data) break;
    }
    if (data) break;
  }

  if (!data) {
    console.log('[API] overpassRestaurants: no data returned');
    return [];
  }
  if (!data || !Array.isArray(data.elements)) {
    console.log('[API] overpassRestaurants: no elements array', { dataType: typeof data, keys: data ? Object.keys(data) : [] });
    return [];
  }

  console.log('[API] overpassRestaurants: got', data.elements.length, 'elements');
  const out = data.elements.map((el: any) => {
    const center = el.type === 'node' ? { lat: el.lat, lon: el.lon } : (el.center || {});
    const tags = el.tags || {};
    const result = {
      id: el.id,
      name: tags.name || 'Unnamed Restaurant',
      address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(' '),
      cuisine: tags.cuisine || 'Various',
      amenity: tags.amenity,
      lat: center.lat,
      lon: center.lon,
    };
    if (!result.lat || !result.lon) {
      console.log('[API] Element missing coordinates:', el.type, el.id, tags.name || tags.amenity);
    }
    return result;
  }).filter((r: any) => r.lat && r.lon);
  console.log('[API] overpassRestaurants: filtered to', out.length, 'results with valid coordinates');

  // cache result
  try {
    pruneCacheIfNeeded();
    OVERPASS_CACHE.set(key, { ts: Date.now(), data: out });
  } catch (e) {}

  return out;
}

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { queryText, coords, radiusMeters = 2000, meal = 'dinner' } = body || {};

    let origin: { lat: number; lon: number; label?: string } | null = null;

    if (coords && typeof coords.lat === 'number' && typeof coords.lon === 'number') {
      origin = { lat: coords.lat, lon: coords.lon };
    } else if (typeof queryText === 'string' && queryText.trim().length > 0) {
      const g = await geocode(queryText.trim());
      if (!g) return NextResponse.json({ error: 'Location not found' }, { status: 404 });
      origin = { lat: g.lat, lon: g.lon, label: g.display_name };
    } else {
      return NextResponse.json({ error: 'Missing location' }, { status: 400 });
    }

    let amenities: string[] = ['restaurant', 'fast_food', 'pub'];
    let opts: { includeCuisineRegex?: string; includeNameRegex?: string; excludeCuisineRegex?: string; excludeNameRegex?: string; diet?: 'vegan' | 'vegetarian' } | undefined;
    switch (meal) {
      case 'snack':
        amenities = ['cafe', 'bakery', 'ice_cream'];
        opts = { includeCuisineRegex: 'ice_cream|dessert|bakery|donut|doughnut|pastry|cupcake|cookie' };
        break;
      case 'coffee':
        amenities = ['cafe'];
        opts = {};
        break;
      case 'breakfast':
        amenities = ['cafe', 'bakery', 'restaurant'];
        opts = { includeCuisineRegex: 'breakfast|bagel|bakery|donut|doughnut|diner|pancake|waffle', includeNameRegex: 'breakfast|bagel|donut|doughnut|diner|pancake|waffle', excludeCuisineRegex: 'pizza', excludeNameRegex: 'Domino' };
        break;
      case 'dessert':
        amenities = ['ice_cream', 'cafe', 'bakery'];
        opts = { includeCuisineRegex: 'dessert|ice_cream|gelato|frozen_yogurt|bakery|pastry' };
        break;
      case 'drinks':
        amenities = ['bar', 'pub', 'biergarten'];
        opts = { includeCuisineRegex: 'bar|pub|cocktail|wine', includeNameRegex: 'bar|pub|cocktail|wine|brew|brewery|taproom' };
        break;
      case 'pizza':
        amenities = ['restaurant', 'fast_food'];
        opts = { includeCuisineRegex: 'pizza' };
        break;
      case 'vegan':
        amenities = ['restaurant', 'cafe'];
        opts = { diet: 'vegan', includeCuisineRegex: 'vegan', includeNameRegex: 'vegan' };
        break;
      case 'vegetarian':
        amenities = ['restaurant', 'cafe'];
        opts = { diet: 'vegetarian', includeCuisineRegex: 'vegetarian|veg', includeNameRegex: 'vegetarian|veggie|veg' };
        break;
      case 'dinner':
      case 'lunch':
      default:
        amenities = ['restaurant', 'fast_food', 'pub', 'cafe', 'food_court', 'bistro'];
        break;
    }

    console.log('[API] Starting search', { meal, amenities, opts, radiusMeters, lat: origin.lat, lon: origin.lon });
    let listings = await overpassRestaurants(origin.lat, origin.lon, radiusMeters, amenities, opts);
    console.log('[API] Initial search returned', listings.length, 'results');

    if (listings.length === 0 && meal === 'coffee') {
      console.log('[API] Coffee: trying with fast_food added');
      listings = await overpassRestaurants(origin.lat, origin.lon, radiusMeters, ['cafe', 'fast_food'], {});
      console.log('[API] Coffee with fast_food returned', listings.length, 'results');
    }

    console.log('[API] Before filtering:', listings.length, 'places');

    const filtered = listings.filter((r: any) => {
      const nm = (r.name || '').trim();
      if (!nm) {
        console.log('[API] Filtering out unnamed place:', r.amenity, r.cuisine);
        return false;
      }
      if (/^unnamed/i.test(nm)) {
        console.log('[API] Filtering out "Unnamed" place');
        return false;
      }
      return true;
    });

    console.log('[API] After filtering:', filtered.length, 'places with names');
    const withDistance = filtered.map((r: any) => {
      const miles = haversineMiles(origin!.lat, origin!.lon, r.lat, r.lon);
      return {
        id: r.id,
        name: r.name,
        address: r.address || 'Nearby',
        cuisine: r.cuisine,
        amenity: r.amenity,
        distance: `${miles.toFixed(1)} miles`,
        lat: r.lat,
        lon: r.lon,
      };
    });

    return NextResponse.json(
      { origin, restaurants: withDistance },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (e) {
    console.log('[API] POST handler error', (e as any)?.message || String(e));
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
};
