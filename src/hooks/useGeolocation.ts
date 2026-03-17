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

  const getLocation = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    // 1. Try API first — instant, no permission needed (user_settings, IP-based on Vercel)
    if (fallbackToApi && typeof fetch === 'function') {
      try {
        const res = await fetch('/api/user/location');
        if (res.ok) {
          const data = await res.json();
          if (data.latitude != null && data.longitude != null) {
            setState({
              latitude: data.latitude,
              longitude: data.longitude,
              accuracy: null,
              error: null,
              loading: false,
              timestamp: Date.now(),
            });
            return;
          }
        }
      } catch {
        // continue to browser geolocation
      }
    }

    // 2. Fall back to browser geolocation
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: 'Geolocation is not supported. Set a default location in Settings.',
        loading: false,
      }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          error: null,
          loading: false,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        let errorMessage = 'Failed to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Set a default location in Settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable. Set a default location in Settings.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Set a default location in Settings.';
            break;
        }
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          loading: false,
        }));
      },
      { enableHighAccuracy, timeout, maximumAge }
    );
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
