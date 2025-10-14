'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { tonyIntroQuotes, tonySpinQuotes, tonyResultQuotes, tonyThinkingQuotes } from '@/app/tonyQuotes';
import { FaMapMarkerAlt, FaUtensils, FaRedo, FaGlassWhiskey, FaLocationArrow } from 'react-icons/fa';
import Wheel from '@/components/Wheel';

// Using a local SVG wheel component to avoid external dependency issues

interface Restaurant {
  id: number;
  name: string;
  address: string;
  cuisine: string;
  distance: string;
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
  const [copied, setCopied] = useState(false);

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

  // Auto-refresh when radius or meal changes and we have prior params
  useEffect(() => {
    if (!lastParams || !meal) return;
    // If we already have a cache, don't hit the API again; show cached
    if (cachedRestaurants.length > 0) {
      setRestaurants(cachedRestaurants);
      return;
    }
    fetchRestaurants({ ...lastParams, radius: radiusMeters, meal });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusMeters, meal, cachedRestaurants.length]);

  // Debounce location typing: auto-fetch but do NOT advance screens
  useEffect(() => {
    const q = location.trim();
    if (!q || !meal) return;
    const t = setTimeout(async () => {
      const qp = { queryText: q } as const;
      setLastParams(qp);
      await fetchRestaurants({ ...qp, radius: radiusMeters, meal });
    }, 500);
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
    await fetchRestaurants({ ...qp, radius: radiusMeters, meal: meal ?? undefined });
    setStep(2);
  };

  const spinWheel = () => {
    if (loading) return;
    const base = (cachedRestaurants.length > 0 ? cachedRestaurants : restaurants);
    if (base.length === 0) return;
    // Per-spin random sample up to 30
    const pool = base.length > 30 ? randomSample(base, 30) : base;
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
  ) {
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
    } finally {
      // Only clear loading if this is the latest request
      if (requestSeq === fetchSeqRef.current) {
        setLoading(false);
        setThinkingIdx(0);
        setThinkingCount(0);
        if (DEBUG) console.timeEnd(`fetchRestaurants [${context}] seq#${requestSeq}`);
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
            <p className="text-center text-amber-200 text-base text-xl leading-snug" style={{ fontFamily: 'var(--font-tony)' }}>
              Don't wanna go nine rounds with your better half on where you want to eat? <br /><small>Relax friend, Tony's got you covered. BOOM.</small>
            </p>
          </div>
        )}

        <div className="bg-slate-800 rounded-lg p-4 shadow-lg mb-4">
          {step === 1 && (
            <div className="text-center pt-3 pb-6">
              <div className="mb-4 flex flex-row items-center justify-center gap-1">
                <div className="flex flex-col items-center w-[180px] min-w-[180px] flex-shrink-0">
                  <div className="flex justify-center pl-2 sm:pl-3">
                    <Image src={(loading && hasLocation && hasMeal) ? "/tony-concerned.png" : "/tony-talking.png"} alt={(loading && hasLocation && hasMeal) ? "Tony thinking" : "Tony talking"} width={160} height={160} priority className="rounded-full shadow-lg" />
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
              <div className="flex items-center justify-center mb-2">
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
                  />
                  <select
                    className="bg-slate-700 text-amber-50 rounded px-2 py-2"
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
                      const q = location.trim();
                      if (val && (lastParams || q)) {
                        const qp = lastParams ?? ({ queryText: q } as const);
                        setLastParams(qp);
                        fetchRestaurants({ ...qp, radius: radiusMeters, meal: val }, 'meal-change');
                      }
                    }}
                    disabled={loading}
                  >
                    <option value="" disabled>Select meal</option>
                    <option value="dinner">Dinner</option>
                    <option value="lunch">Lunch</option>
                    <option value="snack">Snack</option>
                    <option value="coffee">Coffee</option>
                    <option value="breakfast">Breakfast</option>
                    <option value="dessert">Dessert</option>
                    <option value="drinks">Drinks</option>
                    <option value="pizza">Pizza</option>
                    <option value="vegan">Vegan</option>
                    <option value="vegetarian">Vegetarian</option>
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
                            if (meal) {
                              fetchRestaurants({ ...cp, radius: radiusMeters, meal }, 'autocomplete-select');
                            }
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex justify-center">
                {hasLocation && hasMeal && !loading && hasResults && (
                  <button
                    onClick={() => setStep(2)}
                    className={`px-6 py-3 rounded text-lg font-semibold transition-colors bg-amber-600 hover:bg-amber-700`}
                    style={{ fontFamily: 'var(--font-quote)' }}
                  >
                    Hit me with it Tony!
                  </button>
                )}
              </div>
              {hasLocation && hasMeal && !loading && !hasResults && (
                <p className="mt-2 text-sm text-amber-300 text-center">Tony's gotta think a little harder... and widen the search radius.</p>
              )}
              {hasLocation && hasMeal && loading && (
                <p className="mt-4 text-sm text-amber-200 text-center" aria-live="polite">
                  {thinkingIdx === 0 ? 'Tony is thinking...' : tonyThinkingQuotes[thinkingIdx]}
                </p>
              )}
              {hasLocation && hasMeal && loading && (
                <div className="mt-3 w-full flex justify-center">
                  <div className="relative w-64 h-8 overflow-hidden flex items-center justify-center">
                    <img src="/step-progress.gif" alt="Searching..." className="h-8" />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <>
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
            </>
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
                  if anyone asks, you didn’t hear it from me.
                </p>
              {share && (
                <div className="flex items-center justify-center gap-3 text-sm flex-wrap">
                  <a
                    className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-50"
                    href={`https://twitter.com/intent/tweet?text=${share.shareText}&url=${encodeURIComponent(share.url)}`}
                    target="_blank" rel="noopener noreferrer"
                  >
                    Twitter
                  </a>
                  <a
                    className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-50"
                    href={`mailto:?subject=${share.mailSubject}&body=${share.mailBody}`}
                  >
                    Email
                  </a>
                  <a
                    className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-50"
                    href={`sms:?&body=${share.smsBody}`}
                  >
                    SMS
                  </a>
                  <button
                    className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-50"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(share.url);
                        setCopied(true);
                      } catch {}
                    }}
                  >
                    {copied ? 'Copied!' : 'Link'}
                  </button>
                </div>
              )}
              {/* Tip Tony */}
              <div className="mt-4 pt-3 border-t border-amber-900/40">
                <p className="text-center text-amber-300 text-sm mb-2" style={{ fontFamily: 'var(--font-quote)' }}>
                  Wanna tip Tony for the pick?
                </p>
                <div className="flex items-center justify-center gap-3">
                  <a
                    href="https://ko-fi.com/thelowdine"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded bg-rose-500 hover:bg-rose-600 text-white text-sm"
                    style={{ fontFamily: 'var(--font-quote)' }}
                  >
                    Buy Tony a Ko-fi
                  </a>
                  <a
                    href="https://www.buymeacoffee.com/thelowdine"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-500 text-slate-900 text-sm shadow ring-1 ring-amber-500/60"
                    style={{ fontFamily: 'var(--font-quote)' }}
                  >
                    Buy Tony a Coffee
                  </a>
                </div>
              </div>
              </div>
            </div>
          )}
        </div>

        <footer className="text-center text-sm text-amber-900 mt-8">
          <p> {new Date().getFullYear()} The LowDine - The No Drama Dinner Decider</p>
        </footer>
      </div>
    </main>
  );
}
