import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
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
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Lowdine/1.0 (contact: example@example.com)'
    },
    cache: 'no-store',
    signal: controller.signal,
    next: { revalidate: 0 },
  }).finally(() => clearTimeout(to));
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const item = data[0];
  return { lat: parseFloat(item.lat), lon: parseFloat(item.lon), display_name: item.display_name as string };
}

async function overpassRestaurants(
  lat: number,
  lon: number,
  radiusMeters: number,
  amenities: string[],
  opts?: { excludeCuisineRegex?: string; excludeNameRegex?: string; diet?: 'vegan' | 'vegetarian' }
) {
  const am = amenities.join('|');
  const cuisineExclude = opts?.excludeCuisineRegex ? ` ["cuisine"!~"(${opts.excludeCuisineRegex})", i]` : '';
  const nameExclude = opts?.excludeNameRegex ? ` ["name"!~"(${opts.excludeNameRegex})", i]` : '';
  const dietFilter = opts?.diet === 'vegan'
    ? ` ["diet:vegan"="yes"]`
    : opts?.diet === 'vegetarian'
    ? ` ["diet:vegetarian"="yes"]`
    : '';
  const common = `["amenity"~"^(${am})$"]${cuisineExclude}${nameExclude}${dietFilter}`;
  const query = `
    [out:json][timeout:30];
    (
      node${common}(around:${radiusMeters},${lat},${lon});
      way${common}(around:${radiusMeters},${lat},${lon});
      relation${common}(around:${radiusMeters},${lat},${lon});
    );
    out center tags 80;
  `;
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter'
  ];
  let data: any = null;
  for (const ep of endpoints) {
    try {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Lowdine/1.0 (contact: example@example.com)'
        },
        body: new URLSearchParams({ data: query }).toString(),
        cache: 'no-store',
        signal: controller.signal,
        next: { revalidate: 0 },
      }).finally(() => clearTimeout(to));
      if (!res.ok) continue;
      data = await res.json();
      break;
    } catch (e) {
      // try next mirror
    }
  }
  if (!data) return [];
  if (!data || !Array.isArray(data.elements)) return [];
  const out = data.elements.map((el: any) => {
    const center = el.type === 'node' ? { lat: el.lat, lon: el.lon } : (el.center || {});
    const tags = el.tags || {};
    return {
      id: el.id,
      name: tags.name || 'Unnamed Restaurant',
      address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(' '),
      cuisine: tags.cuisine || 'Various',
      lat: center.lat,
      lon: center.lon,
    };
  }).filter((r: any) => r.lat && r.lon);
  return out;
}

export async function POST(req: NextRequest) {
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

    // Decide amenity/filters by meal
    // dinner/lunch: restaurants, fast_food, pub
    // snack: cafes, bakeries, ice_cream
    // coffee: cafe, coffee_shop
    // breakfast: restaurant, cafe, fast_food
    // dessert: ice_cream, cafe, bakery
    // drinks: bar, pub, biergarten
    // pizza: restaurant, fast_food with cuisine=pizza
    // vegan/vegetarian: restaurant, cafe with diet tag
    let amenities: string[] = ['restaurant', 'fast_food', 'pub'];
    let opts: { excludeCuisineRegex?: string; excludeNameRegex?: string; diet?: 'vegan' | 'vegetarian' } | undefined;
    switch (meal) {
      case 'snack':
        amenities = ['cafe', 'bakery', 'ice_cream'];
        break;
      case 'coffee':
        amenities = ['cafe', 'coffee_shop'];
        break;
      case 'breakfast':
        amenities = ['restaurant', 'cafe', 'fast_food'];
        opts = { excludeCuisineRegex: 'pizza', excludeNameRegex: 'Domino' };
        break;
      case 'dessert':
        amenities = ['ice_cream', 'cafe', 'bakery'];
        break;
      case 'drinks':
        amenities = ['bar', 'pub', 'biergarten'];
        break;
      case 'pizza':
        amenities = ['restaurant', 'fast_food'];
        opts = { cuisineRegex: 'pizza' };
        break;
      case 'vegan':
        amenities = ['restaurant', 'cafe'];
        opts = { diet: 'vegan' };
        break;
      case 'vegetarian':
        amenities = ['restaurant', 'cafe'];
        opts = { diet: 'vegetarian' };
        break;
      case 'dinner':
      case 'lunch':
      default:
        amenities = ['restaurant', 'fast_food', 'pub'];
        break;
    }

    const listings = await overpassRestaurants(origin.lat, origin.lon, radiusMeters, amenities, opts);
    const filtered = listings.filter((r: any) => {
      const nm = (r.name || '').trim();
      if (!nm) return false;
      if (/^unnamed/i.test(nm)) return false;
      return true;
    });
    const withDistance = filtered.map((r: any) => {
      const miles = haversineMiles(origin!.lat, origin!.lon, r.lat, r.lon);
      return {
        id: r.id,
        name: r.name,
        address: r.address || 'Nearby',
        cuisine: r.cuisine,
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
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
