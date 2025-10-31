import { NextRequest, NextResponse } from 'next/server';
import { setDefaultResultOrder } from 'node:dns';
import { Pool } from 'pg';

// Ensure Node.js runtime for server-side fetch and DNS control
export const runtime = 'nodejs';

// Route config
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Simple in-memory cache
const DB_CACHE = new Map<string, { ts: number; data: any }>();
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
  if (DB_CACHE.size <= CACHE_MAX) return;
  // remove oldest
  let oldestKey: string | null = null;
  let oldestTs = Infinity;
  for (const k of Array.from(DB_CACHE.keys())) {
    const v = DB_CACHE.get(k)!;
    if (v.ts < oldestTs) {
      oldestTs = v.ts;
      oldestKey = k;
    }
  }
  if (oldestKey) DB_CACHE.delete(oldestKey);
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


async function getRestaurantsFromDB(
  lat: number,
  lon: number,
  radiusMeters: number,
  amenities: string[],
  opts?: { includeCuisineRegex?: string; includeNameRegex?: string; excludeCuisineRegex?: string; excludeNameRegex?: string; diet?: 'vegan' | 'vegetarian' }
) {
  // Check cache first
  const key = cacheKey(lat, lon, radiusMeters, amenities, opts);
  const cached = DB_CACHE.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    // Convert radius from meters to degrees (rough approximation: 1 degree ≈ 111km)
    const radiusKm = radiusMeters / 1000;
    const radiusDeg = radiusKm / 111;

    // Build SQL query with filters
    const queryParams: any[] = [lat - radiusDeg, lat + radiusDeg, lon - radiusDeg, lon + radiusDeg];
    let whereConditions = [
      'lat IS NOT NULL',
      'lon IS NOT NULL',
      'lat BETWEEN $1 AND $2',
      'lon BETWEEN $3 AND $4'
    ];

    // Filter by amenity and/or cuisine/name patterns
    const amenityConditions: string[] = [];
    
    // Amenity filter (OR with other include filters)
    if (amenities.length > 0) {
      queryParams.push(amenities);
      amenityConditions.push(`type = ANY($${queryParams.length})`);
    }
    
    // Include cuisine regex
    if (opts?.includeCuisineRegex) {
      queryParams.push(opts.includeCuisineRegex);
      amenityConditions.push(`type ~* $${queryParams.length}`);
    }
    
    // Include name regex
    if (opts?.includeNameRegex) {
      queryParams.push(opts.includeNameRegex);
      amenityConditions.push(`name ~* $${queryParams.length}`);
    }
    
    // Combine amenity/cuisine/name with OR if we have multiple conditions
    if (amenityConditions.length > 0) {
      whereConditions.push(`(${amenityConditions.join(' OR ')})`);
    }
    
    // Exclude filters (always AND)
    if (opts?.excludeCuisineRegex) {
      queryParams.push(opts.excludeCuisineRegex);
      whereConditions.push(`type !~* $${queryParams.length}`);
    }
    if (opts?.excludeNameRegex) {
      queryParams.push(opts.excludeNameRegex);
      whereConditions.push(`name !~* $${queryParams.length}`);
    }

    const query = `
      SELECT id, name, type, address, lat, lon
      FROM food_places
      WHERE ${whereConditions.join(' AND ')}
      LIMIT 200
    `;

    const result = await pool.query(query, queryParams);

    // Filter by actual distance using Haversine
    const radiusMiles = radiusMeters / 1609.34;
    const filtered = result.rows
      .map((row: any) => {
        const distance = haversineMiles(lat, lon, row.lat, row.lon);
        return { ...row, distanceMiles: distance };
      })
      .filter((row: any) => row.distanceMiles <= radiusMiles);

    const out = filtered.map((row: any) => ({
      id: row.id,
      name: row.name || 'Unnamed Restaurant',
      address: row.address || 'Nearby',
      cuisine: row.type || 'Various',
      amenity: row.type,
      lat: parseFloat(row.lat),
      lon: parseFloat(row.lon),
      qualityScore: 1, // Default quality score
    }));

    // Cache result
    try {
      pruneCacheIfNeeded();
      DB_CACHE.set(key, { ts: Date.now(), data: out });
    } catch (e) {}

    return out;
  } catch (e) {
    console.error('[API] Database query error:', (e as any)?.message || String(e));
    return [];
  }
}

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { coords, radiusMeters = 2000, meal = 'dinner' } = body || {};

    let origin: { lat: number; lon: number; label?: string } | null = null;

    if (coords && typeof coords.lat === 'number' && typeof coords.lon === 'number') {
      origin = { lat: coords.lat, lon: coords.lon };
    } else {
      return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
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
        // Exclude coffee shops and similar from dinner/lunch results
        opts = { 
          excludeCuisineRegex: 'coffee_shop|bubble_tea', 
          excludeNameRegex: 'Starbucks|Dunkin|Coffee|Peet\'s|Dutch Bros|Tim Hortons|Caribou|Costa Coffee|Cafe Nero'
        };
        break;
    }

    let listings = await getRestaurantsFromDB(origin.lat, origin.lon, radiusMeters, amenities, opts);

    if (listings.length === 0 && meal === 'coffee') {
      listings = await getRestaurantsFromDB(origin.lat, origin.lon, radiusMeters, ['cafe', 'fast_food'], {});
    }

    const filtered = listings.filter((r: any) => {
      const nm = (r.name || '').trim();
      if (!nm) return false;
      if (/^unnamed/i.test(nm)) return false;
      return true;
    });
    
    // Sort by quality score (higher is better) to deprioritize potentially stale data
    filtered.sort((a: any, b: any) => (b.qualityScore || 0) - (a.qualityScore || 0));
    
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
};
