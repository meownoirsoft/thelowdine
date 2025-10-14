'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { tonyIntroQuotes, tonySpinQuotes, tonyResultQuotes, tonyThinkingQuotes } from '@/app/tonyQuotes';
import { FaMapMarkerAlt, FaUtensils, FaRedo, FaGlassWhiskey, FaLocationArrow } from 'react-icons/fa';
import Wheel from '@/components/Wheel';
import TipTony from '@/components/TipTony';
import Share from '@/components/Share';
import React from 'react';
import posthog from 'posthog-js';

// Using a local SVG wheel component to avoid external dependency issues

interface Restaurant {
  id: number;
  name: string;
  address: string;
  cuisine: string;
  distance: string;
  amenity?: string;
  lat?: number;
  lon?: number;
}

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
}

type Meal = 'dinner' | 'lunch' | 'snack' | 'coffee' | 'breakfast' | 'dessert' | 'drinks' | 'pizza' | 'vegan' | 'vegetarian';

export default function Home() {
  const [location, setLocation] = useState('');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [wheelRestaurants, setWheelRestaurants] = useState<Restaurant[]>([]);
  const [cachedRestaurants, setCachedRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originLabel, setOriginLabel] = useState<string | null>(null);
  const [prizeNumber, setPrizeNumber] = useState<number>(0);
  const [radiusMeters, setRadiusMeters] = useState<number>(5000);
  const approxMiles = Math.round(radiusMeters / 1609);
  const [meal, setMeal] = useState<Meal | null>(null);
  const [lastParams, setLastParams] = useState<{ queryText?: string; coords?: { lat: number; lon: number } } | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const fetchSeqRef = useRef(0);
  const justSelectedRef = useRef(false);
  const hasLocation = location.trim().length > 0;
  const hasMeal = !!meal;
  const hasResults = restaurants.length > 0;
  const [tonyLine, setTonyLine] = useState<string>('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userEditedLocation, setUserEditedLocation] = useState(false);
  const [thinkingCount, setThinkingCount] = useState(0);
  const [thinkingIdx, setThinkingIdx] = useState(0);
  const [showAbout, setShowAbout] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [excludeFastFood, setExcludeFastFood] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);

  // Debug logging flag and helper
  const DEBUG = true;
  const dlog = (...args: any[]) => { if (DEBUG) console.log('[LowDine]', ...args); };

  const share = useMemo(() => {
    if (!selectedRestaurant) return null;
    const name = encodeURIComponent(selectedRestaurant.name);
    const addressText = selectedRestaurant.address ? ` — ${selectedRestaurant.address}` : '';
    const url = selectedRestaurant.lat && selectedRestaurant.lon
      ? `https://www.google.com/maps/search/?api=1&query=${selectedRestaurant.lat},${selectedRestaurant.lon}`
      : `https://www.google.com/search?q=${name}`;
    const shareTextRaw = `LowDine picked: ${selectedRestaurant.name}${addressText}`;
    const shareText = encodeURIComponent(shareTextRaw);
    const mailSubject = encodeURIComponent('Dinner pick from LowDine');
    const mailBody = encodeURIComponent(`${shareTextRaw}\n${url}`);
    const smsBody = encodeURIComponent(`${shareTextRaw} ${url}`);
    return { url, shareText, mailSubject, mailBody, smsBody };
  }, [selectedRestaurant]);

  const radiusSteps = [2500, 5000, 10000, 16093, 24140] as const;
  function radiusLabel(m: number) {
    switch (m) {
      case 2500: return '~1.5 miles';
      case 5000: return '~3 miles';
      case 10000: return '~6 miles';
      case 16093: return '~10 miles';
      case 24140: return '~15 miles';
      default: return `~${Math.round(m / 1609)} miles`;
    }
  }
 
  // Load cached restaurants on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('lowdine_cache_v1');
      if (raw) {
        const parsed: Restaurant[] = JSON.parse(raw);
        if (Array.isArray(parsed)) setCachedRestaurants(parsed.slice(0, 100));
      }
    } catch {}
  }, []);

  // Persist cache when it changes
  useEffect(() => {
    try {
      localStorage.setItem('lowdine_cache_v1', JSON.stringify(cachedRestaurants.slice(0, 100)));
    } catch {}
  }, [cachedRestaurants]);

  // Load persisted location on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lowdine_location');
      if (saved) {
        setLocation(saved);
        setUserEditedLocation(false);
      }
    } catch {}
  }, []);

  // Persist location when the user types/changes it
  useEffect(() => {
    try {
      localStorage.setItem('lowdine_location', location);
    } catch {}
  }, [location, userEditedLocation]);

  // Load persisted radius on mount
  useEffect(() => {
    try {
      const savedR = localStorage.getItem('lowdine_radius_m');
      if (savedR) {
        const n = parseInt(savedR, 10);
        if (!Number.isNaN(n) && n > 0) setRadiusMeters(n);
      }
    } catch {}
  }, []);

  // Persist radius when it changes
  useEffect(() => {
    try {
      localStorage.setItem('lowdine_radius_m', String(radiusMeters));
    } catch {}
  }, [radiusMeters]);

  useEffect(() => {
    try {
      const v = localStorage.getItem('lowdine_exclude_fast_food');
      if (v !== null) setExcludeFastFood(v === '1');
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('lowdine_exclude_fast_food', excludeFastFood ? '1' : '0');
    } catch {}
  }, [excludeFastFood]);

  // Pick a random Tony quote per screen
  useEffect(() => {
    if (step === 1 && tonyIntroQuotes.length > 0) {
      const q = tonyIntroQuotes[Math.floor(Math.random() * tonyIntroQuotes.length)];
      setTonyLine(q);
    } else if (step === 2 && tonySpinQuotes.length > 0) {
      const q = tonySpinQuotes[Math.floor(Math.random() * tonySpinQuotes.length)];
      setTonyLine(q);
    } else if (step === 3 && tonyResultQuotes.length > 0) {
      const q = tonyResultQuotes[Math.floor(Math.random() * tonyResultQuotes.length)];
      setTonyLine(q);
    }
  }, [step]);

  // Rotate thinking quotes while loading
  useEffect(() => {
    if (!(hasLocation && hasMeal && loading)) {
      setThinkingIdx(0);
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % tonyThinkingQuotes.length;
      setThinkingIdx(i);
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, hasLocation, hasMeal, thinkingCount]);

  // Manual mode: do not auto-refresh on radius/meal change unless a search has been triggered
  useEffect(() => {
    if (!searchTriggered) return;
    if (!lastParams || !meal) return;
    if (cachedRestaurants.length > 0) {
      setRestaurants(cachedRestaurants);
      return;
    }
    // Intentionally skip auto-fetch here to keep user in control; they can click again if desired
  }, [radiusMeters, meal, cachedRestaurants.length, searchTriggered, lastParams, meal]);

  // Debounce location typing: in manual mode we only update lastParams, do not auto-fetch
  useEffect(() => {
    const q = location.trim();
    if (!q) return;
    const t = setTimeout(() => {
      setLastParams({ queryText: q } as const);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  useEffect(() => {
    const q = location.trim();
    if (!userEditedLocation) { // don't open from prefilled/localStorage
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (justSelectedRef.current) return; // suppress immediate reopen after click
    if (q.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const label = `autocomplete ${q}`;
        if (DEBUG) console.time(label);
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error('autocomplete failed');
        const data = await res.json();
        const list: Suggestion[] = Array.isArray(data?.suggestions) ? data.suggestions : [];
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
        dlog('autocomplete results', { q, count: list.length });
        if (DEBUG) console.timeEnd(label);
      } catch {}
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [location]);

  const handleLocationSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!location.trim()) return;
    const qp = { queryText: location.trim() } as const;
    setLastParams(qp);
    try { posthog.capture('location_submit', { location: qp.queryText, meal, exclude_fast_food: excludeFastFood }); } catch {}
    await fetchRestaurants({ ...qp, radius: radiusMeters, meal: meal ?? undefined });
    setStep(2);
  };

  const spinWheel = () => {
    if (loading) return;
    const base = (cachedRestaurants.length > 0 ? cachedRestaurants : restaurants);
    const filtered = excludeFastFood ? base.filter(r => r.amenity !== 'fast_food') : base;
    if (filtered.length === 0) return;
    // Per-spin random sample up to 30
    const pool = filtered.length > 30 ? randomSample(filtered, 30) : filtered;
    try { posthog.capture('wheel_spin', { pool_size: pool.length, exclude_fast_food: excludeFastFood }); } catch {}
    setWheelRestaurants(pool);
    setIsSpinning(true);
    setShowResult(false);
    const randomIndex = Math.floor(Math.random() * pool.length);
    setPrizeNumber(randomIndex);
  };

  const onStopSpinning = () => {
    setIsSpinning(false);
    const source = wheelRestaurants.length > 0 ? wheelRestaurants : restaurants;
    const chosen = source[prizeNumber];
    try { posthog.capture('wheel_result', { id: chosen?.id, name: chosen?.name, cuisine: chosen?.cuisine, distance: chosen?.distance, amenity: chosen?.amenity }); } catch {}
    setSelectedRestaurant(chosen);
    setShowResult(true);
    setStep(3);
  };

  const spinAgain = () => {
    // Return to wheel view and trigger a new spin
    setShowResult(false);
    setStep(2);
    // Allow the wheel to render before starting a new spin
    setTimeout(() => {
      spinWheel();
    }, 0);
  };

  function randomSample<T>(arr: T[], n: number): T[] {
    const result: T[] = [];
    const taken = new Set<number>();
    const m = Math.min(n, arr.length);
    while (result.length < m) {
      const idx = Math.floor(Math.random() * arr.length);
      if (!taken.has(idx)) {
        taken.add(idx);
        result.push(arr[idx]);
      }
    }
    return result;
  }

  const useMyLocation = async () => {
    setError(null);
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported in this browser.');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const cp = { coords: { lat: latitude, lon: longitude } } as const;
        setLastParams(cp);
        if (meal) {
          await fetchRestaurants({ ...cp, radius: radiusMeters, meal });
        }
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        setError('Unable to get your location. Please enter an address or zip.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  async function fetchRestaurants(
    params: { queryText?: string; coords?: { lat: number; lon: number }; radius?: number; meal?: 'dinner' | 'lunch' | 'snack' | 'coffee' | 'breakfast' | 'dessert' | 'drinks' | 'pizza' | 'vegan' | 'vegetarian' },
    context: string = 'unknown'
  ) 
  {
    let requestSeq = 0;
    try {
      if (!params.meal) return; // require meal selection before fetching
      // If cache exists, skip network and use it
      if (cachedRestaurants.length > 0) {
        dlog('cache hit: using cachedRestaurants', { count: cachedRestaurants.length });
        setRestaurants(cachedRestaurants);
        setWheelRestaurants(cachedRestaurants.length > 30 ? randomSample(cachedRestaurants, 30) : cachedRestaurants);
        // Ensure any externally-set loading state is cleared, since requestSeq is 0 and finally won't clear it
        setLoading(false);
        setThinkingIdx(0);
        setThinkingCount(0);
        return;
      }
      requestSeq = ++fetchSeqRef.current;
      const overallLabel = `fetchRestaurants [${context}] seq#${requestSeq}`;
      if (DEBUG) console.time(overallLabel);
      dlog('fetch start', { ctx: context, params: { ...params, radius: params.radius ?? radiusMeters } });
      setThinkingCount((c) => c + 1);
      setLoading(true);
      setError(null);
      setSelectedRestaurant(null);
      setShowResult(false);
      const tryFetch = async (r: number) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const fetchLabel = `POST /api/restaurants [${context}] radius=${r} seq#${requestSeq}`;
        if (DEBUG) console.time(fetchLabel);
        const res = await fetch('/api/restaurants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...params, radiusMeters: r, meal: params.meal ?? meal }),
          cache: 'no-store',
          signal: controller.signal,
        }).finally(() => { if (DEBUG) console.timeEnd(fetchLabel); clearTimeout(timeout); });
        if (!res.ok) {
          const t = await res.json().catch(() => ({}));
          throw new Error(t.error || 'Failed to fetch restaurants');
        }
        const data = await res.json();
        dlog('fetch result', { ctx: context, radius: r, origin: data?.origin?.label, count: Array.isArray(data?.restaurants) ? data.restaurants.length : 0 });
        return data as any;
      };

      let usedRadius = params.radius ?? radiusMeters;
      let data = await tryFetch(usedRadius);
      if (requestSeq !== fetchSeqRef.current) return; // a newer request started; ignore
      setOriginLabel(data.origin?.label || null);
      let list: Restaurant[] = Array.isArray(data.restaurants) ? data.restaurants : [];

      // If empty, escalate radius through the predefined steps
      if (list.length === 0) {
        const currentIdx = Math.max(0, radiusSteps.findIndex(v => v === usedRadius));
        for (let i = currentIdx + 1; i < radiusSteps.length; i++) {
          const nextR = radiusSteps[i];
          dlog('escalating radius', { ctx: context, from: usedRadius, to: nextR });
          const d2 = await tryFetch(nextR);
          if (requestSeq !== fetchSeqRef.current) return; // ignore outdated escalation
          const l2: Restaurant[] = Array.isArray(d2.restaurants) ? d2.restaurants : [];
          if (l2.length > 0) {
            data = d2;
            list = l2;
            usedRadius = nextR;
            break;
          }
        }
      }

      if (list.length > 1 && list.length % 2 === 1) {
        list = list.slice(0, list.length - 1);
      }
      // Reflect the radius that produced results (if any)
      if (requestSeq !== fetchSeqRef.current) return;
      if (usedRadius !== radiusMeters) setRadiusMeters(usedRadius);
      setRestaurants(list);
      try { posthog.capture('search_results', { count: list.length, used_radius_m: usedRadius, meal: params.meal ?? meal, exclude_fast_food: excludeFastFood }); } catch {}
      dlog('final results', { ctx: context, usedRadius, count: list.length });
      // Merge into cache (cap 100 by unique id)
      setCachedRestaurants(prev => {
        const byId = new Map<number, Restaurant>();
        for (const r of prev) byId.set(r.id, r);
        for (const r of list) if (!byId.has(r.id)) byId.set(r.id, r);
        return Array.from(byId.values()).slice(0, 100);
      });
      // Prepare an initial wheel set; subsequent spins will resample per spin
      const wheelSet = list.length > 30 ? randomSample(list, 30) : list;
      setWheelRestaurants(wheelSet);
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        // Only show timeout if this is still the latest request
        if (requestSeq === fetchSeqRef.current) {
          setError('Request timed out. Try again or widen the radius.');
        }
      } else {
        setError(e.message || 'Something went wrong');
      }
      try { posthog.capture('search_error', { message: e?.message || String(e) }); } catch {}
    } finally {
      // Only clear loading if this is the latest request
      if (requestSeq === fetchSeqRef.current) {
        setLoading(false);
        setThinkingIdx(0);
        setThinkingCount(0);
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 text-amber-50 py-2 px-4 pt-0">
      <div className="container mx-auto max-w-md">
        <div className="py-3 flex justify-center">
          <Image src="/thelowdine-logo.png" alt="The LowDine" width={160} height={40} priority />
        </div>
        {step === 1 && (
          <div className="mb-3 px-1">
            <p className="text-center text-amber-200 text-base text-lg leading-snug" style={{ fontFamily: 'var(--font-tony)' }}>
              Don't wanna go nine rounds with <br />your better half on where to eat? <br /><small>Relax friend, Tony's got you covered. BOOM.</small>
            </p>
          </div>
        )}

        <div className="bg-slate-800 rounded-lg p-4 shadow-lg mb-4">
          {step === 1 && (
            <div className="text-center pt-3 pb-6">
              <div className="mb-4 flex flex-row items-center justify-center gap-1">
                <div className="flex flex-col items-center w-[180px] min-w-[180px] flex-shrink-0">
                  <div className="flex justify-center pl-2 sm:pl-3">
                    <Image src={(searchTriggered && loading && hasLocation && hasMeal) ? "/tony-concerned.png" : "/tony-talking.png"} alt={(searchTriggered && loading && hasLocation && hasMeal) ? "Tony thinking" : "Tony talking"} width={160} height={160} priority className="rounded-full shadow-lg" />
                  </div>
                </div>
                <div className="w-[224px] sm:w-[256px] min-w-[224px] pr-2 sm:pr-2 -mt-4 -ml-4 mr-4">
                  <p key={tonyLine} className="text-amber-200 italic text-2xl sm:text-3xl leading-snug text-left tracking-tight animate-fade-in" style={{ fontFamily: 'var(--font-quote)' }}>{tonyLine}</p>
                  <div className="mt-2 flex justify-start">
                    <div
                      className="w-full h-12 sm:h-14 flex items-center justify-center text-2xl sm:text-3xl font-bold tracking-normal text-slate-900 leading-tight text-center shadow"
                      style={{ fontFamily: 'var(--font-tony)', backgroundImage: "url('/name-ribbon.png')", backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}
                    >
                      <span className="-translate-y-[2px] inline-block">Tony Spinelli</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="hidden">
                <button
                  onClick={useMyLocation}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-md"
                  style={{ fontFamily: 'var(--font-quote)' }}
                  disabled={loading}
                >
                  <FaLocationArrow /> Use my location
                </button>
              </div>
              <div className="mb-3">
                <div className="flex items-center justify-center gap-2 relative">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => { setLocation(e.target.value); setUserEditedLocation(true); }}
                    onFocus={(e) => {
                      // select all so new typing replaces previous entry
                      e.currentTarget.select();
                      if (userEditedLocation && suggestions.length > 0) setShowSuggestions(true);
                    }}
                    onMouseUp={(e) => {
                      // prevent clearing the programmatic selection on mouse up
                      e.preventDefault();
                    }}
                    onBlur={() => {
                      // delay to allow click on suggestion
                      setTimeout(() => setShowSuggestions(false), 150);
                    }}
                    placeholder="Enter your location or zip code"
                    className="w-48 sm:w-64 px-3 py-2 rounded-lg bg-slate-700 text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    style={{ fontFamily: 'var(--font-quote)' }}
                  />
                  <select
                    className="bg-slate-700 text-amber-50 rounded px-2 py-2"
                    style={{ fontFamily: 'var(--font-quote)' }}
                    value={meal ?? ''}
                    onChange={(e) => {
                      const v = e.target.value as Meal | '';
                      const val = v === '' ? null : v;
                      setMeal(val);
                      // Clear prior meal/location cache to ensure fresh fetch for the new meal
                      setCachedRestaurants([]);
                      setRestaurants([]);
                      setWheelRestaurants([]);
                      setSelectedRestaurant(null);
                      setShowResult(false);
                      try { posthog.capture('meal_selected', { meal: val }); } catch {}
                    }}
                    disabled={loading}
                  >
                    <option value="" disabled>Meal?</option>
                    <option value="dinner">Dinner</option>
                    <option value="lunch">Lunch</option>
                    <option value="snack">Snack</option>
                    <option value="coffee">Coffee</option>
                    <option value="breakfast">Breakfast</option>
                    <option value="dessert">Dessert</option>
                    <option value="drinks">Drinks</option>
                    <option value="pizza">Pizza</option>
                    <option value="vegan">Vegan</option>
                    <option value="vegetarian">Veggie</option>
                  </select>
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-[min(20rem,90vw)] max-h-56 overflow-auto bg-slate-800 border border-slate-700 rounded-md shadow-lg z-20">
                      {suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          className="w-full text-left px-3 py-2 hover:bg-slate-700 text-amber-50"
                          onClick={() => {
                            setLocation(s.label);
                            const cp = { coords: { lat: s.lat, lon: s.lon } } as const;
                            setLastParams(cp);
                            setShowSuggestions(false);
                            setSuggestions([]);
                            setUserEditedLocation(false);
                            justSelectedRef.current = true;
                            setTimeout(() => { justSelectedRef.current = false; }, 400);
                            try { posthog.capture('location_autocomplete_selected', { label: s.label, lat: s.lat, lon: s.lon }); } catch {}
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-center">
                <label className="flex items-center gap-2 text-amber-200 text-sm" style={{ fontFamily: 'var(--font-quote)' }}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-amber-600"
                    checked={excludeFastFood}
                    onChange={(e) => { setExcludeFastFood(e.target.checked); try { posthog.capture('exclude_fast_food_toggled', { value: e.target.checked }); } catch {} }}
                  />
                  Exclude Fast Food
                </label>
              </div>
              <div className="mt-2 text-center">
                <p className="text-amber-200 text-md sm:text-sm" style={{ fontFamily: 'var(--font-quote)' }}>
                  Just add zip/address and meal you're hankering for, and Tony will let 'er rip!
                </p>
              </div>
              <div className="mt-3 flex justify-center">
                {hasLocation && hasMeal && !loading && (
                  <button
                    onClick={async () => {
                      const q = location.trim();
                      if (!q || !meal) return;
                      const qp = { queryText: q } as const;
                      setLastParams(qp);
                      setSearchTriggered(true);
                      try { posthog.capture('search_clicked', { location: q, meal, exclude_fast_food: excludeFastFood, radius_m: radiusMeters }); } catch {}
                      await fetchRestaurants({ ...qp, radius: radiusMeters, meal });
                      setStep(2);
                    }}
                    className={`px-6 py-3 rounded text-lg font-semibold transition-colors bg-amber-600 hover:bg-amber-700`}
                    style={{ fontFamily: 'var(--font-quote)' }}
                  >
                    Let 'Er Rip!
                  </button>
                )}
              </div>
              {searchTriggered && hasLocation && hasMeal && !loading && !hasResults && (
                <p className="mt-2 text-sm text-amber-300 text-center">Tony's gotta think a little harder... and widen the search radius.</p>
              )}
              {searchTriggered && hasLocation && hasMeal && loading && (
                <p className="mt-4 text-sm text-amber-200 text-center" aria-live="polite" style={{ fontFamily: 'var(--font-quote)' }}>
                  {thinkingIdx === 0 ? 'Tony is thinking...' : tonyThinkingQuotes[thinkingIdx]}
                </p>
              )}
              {searchTriggered && hasLocation && hasMeal && loading && (
                <div className="mt-3 w-full flex justify-center">
                  <div className="relative w-64 h-8 overflow-hidden flex items-center justify-center">
                    <img src="/step-progress.gif" alt="Searching..." className="h-8" />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <React.Fragment>
              {/* location/meal/radius moved to step 1; Screen 2 only shows wheel */}
              {restaurants.length > 0 && (
                <div className="text-center">
                  <div className="mb-4 flex flex-row items-center justify-center gap-1">
                    <div className="flex flex-col items-center w-[180px] min-w-[180px] flex-shrink-0">
                      <div className="flex justify-center pl-2 sm:pl-3">
                        <Image src="/tony-sideeye.png" alt="Tony side-eye" width={160} height={160} priority className="rounded-full shadow-md" />
                      </div>
                      
                    </div>
                    <div className="w-[224px] sm:w-[256px] min-w-[224px] pr-2 sm:pr-2 -mt-4 -ml-4 mr-4">
                      <p key={tonyLine} className="text-amber-200 italic text-2xl sm:text-3xl leading-snug text-left tracking-tight animate-fade-in" style={{ fontFamily: 'var(--font-quote)' }}>{tonyLine}</p>
                      <div className="mt-2 flex justify-start">
                        <div
                          className="w-full h-12 sm:h-14 flex items-center justify-center text-2xl sm:text-3xl font-bold tracking-normal text-slate-900 leading-tight text-center shadow"
                          style={{ fontFamily: 'var(--font-tony)', backgroundImage: "url('/name-ribbon.png')", backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}
                        >
                          <span className="-translate-y-[2px] inline-block">Tony Spinelli</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="w-full h-80 sm:h-96 mb-4 flex items-center justify-center">
                    {restaurants.length > 0 && (
                      <div className="relative w-[320px] h-[320px]">
                          <Wheel
                            mustStartSpinning={isSpinning}
                            prizeNumber={prizeNumber}
                            size={320}
                            data={(wheelRestaurants.length > 0 ? wheelRestaurants : restaurants).map((_, idx) => ({
                              option: String(idx + 1),
                              style: { backgroundColor: '#b45309', textColor: 'white' }
                            }))}
                            onStopSpinning={onStopSpinning}
                          />
                          {loading && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                              <div className="relative w-40 h-10 overflow-hidden flex items-center justify-center">
                                <img src="/step-progress.gif" alt="Searching..." className="h-8" />
                              </div>
                            </div>
                          )}
                        </div>
                    )}
                  </div>

                  <button
                    onClick={spinWheel}
                    disabled={isSpinning || restaurants.length === 0}
                    className={`px-5 py-2.5 rounded-full font-semibold text-xl sm:text-2xl mb-2 transition-all ${
                      isSpinning || restaurants.length === 0
                        ? 'bg-amber-800 cursor-not-allowed'
                        : 'bg-amber-600 hover:bg-amber-700 transform hover:scale-105'
                    }`}
                    style={{ fontFamily: 'var(--font-quote)' }}
                  >
                    {isSpinning ? 'Spinning...' : 'Spin the Wheel'}
                  </button>
                  <div>
                    <button className="mt-2 text-amber-200 underline" style={{ fontFamily: 'var(--font-quote)' }} onClick={() => setStep(1)}>Back to Start</button>
                  </div>
                </div>
              )}
            </React.Fragment>
          )}

          {step === 3 && showResult && selectedRestaurant && (
            <div className="text-center">
              <div className="mb-4 flex flex-row items-center justify-center gap-1">
                <div className="flex flex-col items-center w-[180px] min-w-[180px] flex-shrink-0">
                  <div className="flex justify-center pl-2 sm:pl-3">
                    <Image src="/tony-wink.png" alt="Tony wink" width={160} height={160} priority className="rounded-full shadow-md" />
                  </div>
                  
                </div>
                <div className="w-[224px] sm:w-[256px] min-w-[224px] pr-2 sm:pr-2 -mt-4 -ml-4 mr-4">
                  <p key={tonyLine} className="text-amber-200 italic text-2xl sm:text-3xl leading-snug text-left tracking-tight animate-fade-in" style={{ fontFamily: 'var(--font-quote)' }}>{tonyLine}</p>
                  <div className="mt-2 flex justify-start">
                    <div
                      className="w-full h-12 sm:h-14 flex items-center justify-center text-2xl sm:text-3xl font-bold tracking-normal text-slate-900 leading-tight text-center shadow"
                      style={{ fontFamily: 'var(--font-tony)', backgroundImage: "url('/name-ribbon.png')", backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}
                    >
                      <span className="-translate-y-[2px] inline-block">Tony Spinelli</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-slate-700 rounded-lg animate-fade-in">
                <h3 className="text-lg font-bold text-amber-300 mb-2 flex items-center justify-center">
                  <FaMapMarkerAlt className="mr-2 text-amber-400" />
                  {selectedRestaurant.name}
                </h3>
                {selectedRestaurant.address && (
                  <p className="text-amber-100 text-center mb-1">
                    {selectedRestaurant.address}
                  </p>
                )}
                <p className="text-amber-200">{selectedRestaurant.cuisine} • {selectedRestaurant.distance} away</p>
                
                <div className="mt-4 flex flex-col items-center gap-2">
                  <button
                    onClick={spinAgain}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-lg flex items-center shadow ring-1 ring-amber-500/60"
                    style={{ fontFamily: 'var(--font-quote)' }}
                  >
                    <FaRedo className="mr-2" />
                    Double or Muffin
                  </button>
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href={selectedRestaurant.lat && selectedRestaurant.lon ? `https://www.google.com/maps/search/?api=1&query=${selectedRestaurant.lat},${selectedRestaurant.lon}` : '#'}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center"
                    style={{ fontFamily: 'var(--font-quote)' }}
                  >
                    <FaUtensils className="mr-2" />
                    Let's go, Tony! (map it)
                  </a>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-center">
                <button className="text-amber-200 underline" style={{ fontFamily: 'var(--font-quote)' }} onClick={() => { setShowResult(false); setStep(1); }}>Back to Start</button>
              </div>
              <div className="mt-4 px-3 py-3 border-t border-amber-900/40">
                <p className="text-center text-amber-300 text-sm mb-2" style={{ fontFamily: 'var(--font-quote)' }}>
                  if anyone asks, you didn't hear it from me.
                </p>
                {share && (
                  <Share share={share} />
                )}
                {/* Tip Tony */}
                <TipTony />
              </div>
            </div>
          )}

          {/* About Modal */}
          {showAbout && (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/60" onClick={() => setShowAbout(false)}></div>
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-slate-800 text-amber-50 rounded-lg shadow-lg ring-1 ring-slate-700">
                  <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                    <h2 className="text-lg text-amber-300" style={{ fontFamily: 'var(--font-quote)' }}>About The LowDine</h2>
                    <button className="text-amber-300 hover:text-amber-200" onClick={() => setShowAbout(false)}>✕</button>
                  </div>
                  <div className="px-4 py-4">
                    <p className="mb-2" style={{ fontFamily: 'var(--font-quote)' }}>
                      The LowDine is your no-drama dinner decider, starring Tony Spinelli. Saving dinner and relationships since a while ago.
                    </p>
                  </div>
                  <div className="px-4 py-3 border-t border-slate-700 flex justify-end">
                    <button className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 rounded text-sm" style={{ fontFamily: 'var(--font-quote)' }} onClick={() => setShowAbout(false)}>Close</button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {showContact && (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/60" onClick={() => setShowContact(false)}></div>
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-slate-800 text-amber-50 rounded-lg shadow-lg ring-1 ring-slate-700">
                  <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                    <h2 className="text-lg text-amber-300" style={{ fontFamily: 'var(--font-quote)' }}>Contact</h2>
                    <button className="text-amber-300 hover:text-amber-200" onClick={() => setShowContact(false)}>✕</button>
                  </div>
                  <div className="px-4 py-4 space-y-2">
                    <p style={{ fontFamily: 'var(--font-quote)' }}>Questions, ideas, or a hot tip on a joint?</p>
                    <div className="flex flex-col gap-2 text-sm">
                      <a className="underline text-amber-300 hover:text-amber-200" href="mailto:tony@thelowdine.com">tony@thelowdine.com</a>
                    </div>
                  </div>
                  <div className="px-4 py-3 border-t border-slate-700 flex justify-end">
                    <button className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 rounded text-sm" style={{ fontFamily: 'var(--font-quote)' }} onClick={() => setShowContact(false)}>Close</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
       </div>{/* DO NOT REMOVE THIS END DIV */}
    </main>
  );
}