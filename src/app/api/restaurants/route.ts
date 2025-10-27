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
  opts?: { includeCuisineRegex?: string; includeNameRegex?: string; excludeCuisineRegex?: string; excludeNameRegex?: string; diet?: 'vegan' | 'vegetarian' }
) {
  const am = amenities.join('|');
  const cuisineInclude = opts?.includeCuisineRegex ? ` ["cuisine"~"(${opts.includeCuisineRegex})", i]` : '';
  const cuisineExclude = opts?.excludeCuisineRegex ? ` ["cuisine"!~"(${opts.excludeCuisineRegex})", i]` : '';
  const nameInclude = opts?.includeNameRegex ? ` ["name"~"(${opts.includeNameRegex})", i]` : '';
  const nameExclude = opts?.excludeNameRegex ? ` ["name"!~"(${opts.excludeNameRegex})", i]` : '';
  const dietFilter = opts?.diet === 'vegan'
    ? ` ["diet:vegan"="yes"]`
    : opts?.diet === 'vegetarian'
    ? ` ["diet:vegetarian"="yes"]`
    : '';
  const common = `["amenity"~"^(${am})$"]${cuisineInclude}${cuisineExclude}${nameInclude}${nameExclude}${dietFilter}`;
  const query = `
    [out:json][timeout:30];
    (
      node${common}(around:${radiusMeters},${lat},${lon});
      way${common}(around:${radiusMeters},${lat},${lon});
      relation${common}(around:${radiusMeters},${lat},${lon});
    );
    out center tags 80;
  `;
  console.log('[API] Overpass Query:', query);
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
    let opts: { includeCuisineRegex?: string; includeNameRegex?: string; excludeCuisineRegex?: string; excludeNameRegex?: string; diet?: 'vegan' | 'vegetarian' } | undefined;
    switch (meal) {
      case 'snack':
        amenities = ['cafe', 'bakery', 'ice_cream'];
        opts = { includeCuisineRegex: 'ice_cream|dessert|bakery|donut|doughnut|pastry|cupcake|cookie' };
        break;
      case 'coffee':
        // Start with broader search - just get any cafe
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
        // Include more amenity types for broader results
        amenities = ['restaurant', 'fast_food', 'pub', 'cafe', 'food_court', 'bistro'];
        break;
    }

    console.log('[API] Starting search', { meal, amenities, opts, radiusMeters, lat: origin.lat, lon: origin.lon });
    let listings = await overpassRestaurants(origin.lat, origin.lon, radiusMeters, amenities, opts);
    console.log('[API] Initial search returned', listings.length, 'results');
    
    // If still no results for coffee, try adding fast_food (McDonald's, etc often have good coffee)
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
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
