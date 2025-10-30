import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { generateShortId } from '@/lib/shortId';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

interface SharedRestaurant {
  id: number;
  name: string;
  address: string;
  cuisine: string;
  distance: string;
  lat?: number;
  lon?: number;
}

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { restaurant } = body as { restaurant: SharedRestaurant };

    if (!restaurant) {
      return NextResponse.json(
        { error: 'Missing restaurant' },
        { status: 400 }
      );
    }

    // Generate a short ID
    const shortId = generateShortId();

    const query = `
      INSERT INTO shared_results (id, short_id, restaurant_id, restaurant_name, restaurant_address, restaurant_cuisine, restaurant_distance, restaurant_lat, restaurant_lon)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        restaurant_id = EXCLUDED.restaurant_id,
        restaurant_name = EXCLUDED.restaurant_name,
        restaurant_address = EXCLUDED.restaurant_address,
        restaurant_cuisine = EXCLUDED.restaurant_cuisine,
        restaurant_distance = EXCLUDED.restaurant_distance,
        restaurant_lat = EXCLUDED.restaurant_lat,
        restaurant_lon = EXCLUDED.restaurant_lon
    `;

    const longId = `${restaurant.id}_${Date.now()}`;
    await pool.query(query, [
      longId,
      shortId,
      restaurant.id,
      restaurant.name,
      restaurant.address,
      restaurant.cuisine,
      restaurant.distance,
      restaurant.lat ?? null,
      restaurant.lon ?? null,
    ]);

    return NextResponse.json({ success: true, shortId });
  } catch (e) {
    console.error('[API] Share POST error:', (e as any)?.message || String(e));
    return NextResponse.json(
      { error: 'Failed to save share' },
      { status: 500 }
    );
  }
};

export const GET = async (req: NextRequest) => {
  try {
    const searchParams = req.nextUrl.searchParams;
    const shortId = searchParams.get('id');

    if (!shortId) {
      return NextResponse.json(
        { error: 'Missing id' },
        { status: 400 }
      );
    }

    const query = `
      SELECT restaurant_id, restaurant_name, restaurant_address, restaurant_cuisine, restaurant_distance, restaurant_lat, restaurant_lon
      FROM shared_results
      WHERE short_id = $1
    `;

    const result = await pool.query(query, [shortId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Share not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    const restaurant: SharedRestaurant = {
      id: row.restaurant_id,
      name: row.restaurant_name,
      address: row.restaurant_address,
      cuisine: row.restaurant_cuisine,
      distance: row.restaurant_distance,
      lat: row.restaurant_lat ? parseFloat(row.restaurant_lat) : undefined,
      lon: row.restaurant_lon ? parseFloat(row.restaurant_lon) : undefined,
    };

    return NextResponse.json({ restaurant });
  } catch (e) {
    console.error('[API] Share GET error:', (e as any)?.message || String(e));
    return NextResponse.json(
      { error: 'Failed to retrieve share' },
      { status: 500 }
    );
  }
};
