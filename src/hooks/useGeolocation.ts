'use client';

import { useState, useCallback, useEffect } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  timestamp: number | null;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  autoFetch?: boolean;
  fallbackToApi?: boolean;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = false,
    timeout = 15000,
    maximumAge = 300000, // Cache for 5 minutes
    autoFetch = false,
    fallbackToApi = true,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
    timestamp: null,
  });

  const resolvedRef = { current: false };

  const getLocation = useCallback(() => {
    resolvedRef.current = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const resolve = (lat: number, lng: number, acc: number | null) => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      setState({
        latitude: lat,
        longitude: lng,
        accuracy: acc,
        error: null,
        loading: false,
        timestamp: Date.now(),
      });
    };

    // Race: browser geolocation and API run in parallel, first valid result wins
    let browserDone = false;
    let apiDone = false;

    const checkAllFailed = (errorMsg: string) => {
      if (!resolvedRef.current && browserDone && apiDone) {
        setState((prev) => ({ ...prev, error: errorMsg, loading: false }));
      }
    };

    // 1. Browser geolocation (works immediately if permission is granted/cached)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          browserDone = true;
          resolve(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
        },
        (error) => {
          browserDone = true;
          let msg = 'Location unavailable.';
          if (error.code === error.PERMISSION_DENIED) msg = 'Location permission denied.';
          else if (error.code === error.TIMEOUT) msg = 'Location request timed out.';
          checkAllFailed(msg + ' Set a default location in Settings.');
        },
        { enableHighAccuracy, timeout, maximumAge }
      );
    } else {
      browserDone = true;
    }

    // 2. API fallback (saved default or Vercel IP geolocation)
    if (fallbackToApi) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      fetch('/api/user/location', { signal: controller.signal })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          clearTimeout(timeoutId);
          apiDone = true;
          if (data?.latitude != null && data?.longitude != null) {
            resolve(data.latitude, data.longitude, null);
          } else {
            checkAllFailed('Location unavailable. Set a default location in Settings.');
          }
        })
        .catch(() => {
          clearTimeout(timeoutId);
          apiDone = true;
          checkAllFailed('Location unavailable. Set a default location in Settings.');
        });
    } else {
      apiDone = true;
    }

    // If browser geo isn't supported and no API, fail immediately
    if (browserDone && apiDone && !resolvedRef.current) {
      setState((prev) => ({
        ...prev,
        error: 'Geolocation is not supported. Set a default location in Settings.',
        loading: false,
      }));
    }
  }, [enableHighAccuracy, timeout, maximumAge, fallbackToApi]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      getLocation();
    }
  }, [autoFetch, getLocation]);

  return {
    ...state,
    getLocation,
    hasLocation: state.latitude !== null && state.longitude !== null,
  };
}

// Calculate distance between two coordinates in miles
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
