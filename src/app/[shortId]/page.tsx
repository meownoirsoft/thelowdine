'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { FaMapMarkerAlt, FaUtensils } from 'react-icons/fa';
import Link from 'next/link';
import { trackEvent } from '@/lib/plausibleClient';
import { useParams } from 'next/navigation';

interface Restaurant {
  id: number;
  name: string;
  address: string;
  cuisine: string;
  distance: string;
  lat?: number;
  lon?: number;
}

export default function ShortLinkPage() {
  const params = useParams();
  const shortId = params.shortId as string;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchSharedRestaurant = async () => {
      try {
        const res = await fetch(`/api/share?id=${encodeURIComponent(shortId)}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        const restaurant = data.restaurant as Restaurant;
        setRestaurant(restaurant);
        
        // Track that someone visited a shared link
        try {
          trackEvent('share_visited', { restaurant_id: restaurant.id, restaurant_name: restaurant.name });
        } catch {}
        
        // Generate map URL
        const name = encodeURIComponent(restaurant.name);
        const url = restaurant.lat && restaurant.lon
          ? `https://www.google.com/maps/search/?api=1&query=${name}+${encodeURIComponent(restaurant.address || `${restaurant.lat},${restaurant.lon}`)}`
          : `https://www.google.com/search?q=${name}`;
        setMapUrl(url);
      } catch (e) {
        console.error('Failed to load shared restaurant:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchSharedRestaurant();
  }, [shortId]);

  const handleMapClick = () => {
    try {
      trackEvent('shared_result_map_clicked', { id: restaurant?.id, name: restaurant?.name });
    } catch {}
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-900 text-amber-50 py-8 px-4">
        <div className="container mx-auto max-w-md text-center">
          <p className="text-amber-200">Loading...</p>
        </div>
      </main>
    );
  }

  if (!restaurant) {
    return (
      <main className="min-h-screen bg-slate-900 text-amber-50 py-8 px-4">
        <div className="container mx-auto max-w-md text-center">
          <p className="text-amber-300 mb-4">Restaurant not found</p>
          <Link href="/" className="text-amber-200 underline">Back to The Lowdine</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-amber-50 py-8 px-4">
      <div className="container mx-auto max-w-md">
        <div className="py-3 flex justify-center mb-6">
          <Image src="/thelowdine-logo.webp" alt="The Lowdine" width={160} height={40} priority sizes="160px" />
        </div>

        <div className="bg-slate-800 rounded-lg p-6 shadow-lg mb-4">
          <div className="mb-4 flex flex-row items-center justify-center gap-1">
            <div className="flex flex-col items-center w-[180px] min-w-[180px] flex-shrink-0">
              <div className="flex justify-center pl-2 sm:pl-3">
                <Image src="/tony-wink.webp" alt="Tony wink" width={160} height={160} className="rounded-full shadow-md" />
              </div>
            </div>
            <div className="w-[224px] sm:w-[256px] min-w-[224px] pr-2 sm:pr-2 -mt-4 -ml-4 mr-4">
              <p className="text-amber-200 italic text-lg sm:text-xl leading-snug text-left tracking-tight" style={{ fontFamily: 'var(--font-quote)' }}>
                Friends don't let friends decide dinner alone.
              </p>
              <div className="mt-2 flex justify-start">
                <div
                  className="w-full h-12 sm:h-14 flex items-center justify-center text-2xl sm:text-3xl font-bold tracking-normal text-slate-900 leading-tight text-center shadow"
                  style={{ fontFamily: 'var(--font-tony)', backgroundImage: "url('/name-ribbon.webp')", backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}
                >
                  <span className="-translate-y-[2px] inline-block">Tony Spinelli</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-slate-700 rounded-lg">
            <h3 className="text-2xl font-bold text-amber-300 mb-2 flex items-center justify-center">
              <FaMapMarkerAlt className="mr-2 text-amber-400" />
              {restaurant.name}
            </h3>
            {restaurant.address && (
              <p className="text-amber-100 text-center mb-1">
                {restaurant.address}
              </p>
            )}
            <p className="text-amber-200 text-center">{restaurant.distance} away</p>
          </div>

          <div className="mt-6 flex justify-center">
            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleMapClick}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg flex items-center text-lg font-semibold transition-colors"
                style={{ fontFamily: 'var(--font-quote)' }}
              >
                <FaUtensils className="mr-2" />
                Map it Tony!
              </a>
            )}
          </div>

          <div className="mt-6 flex justify-center">
            <Link href="/" className="text-amber-200 underline" style={{ fontFamily: 'var(--font-quote)' }}>
              Find another
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
