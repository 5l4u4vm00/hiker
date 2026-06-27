import type { LngLat } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

/**
 * Subscribes to the device's foreground position and returns the latest fix as
 * `[lon, lat]` (the project's GeoJSON/LngLat order), or `null` until a fix is
 * available or if permission is denied.
 *
 * Used for the on-screen coordinate readout when not recording — recording
 * already keeps fresh coordinates in the recording store, so callers should pass
 * `enabled = false` while a hike is active to avoid a duplicate subscription.
 */
export function useCurrentLocation(enabled = true): LngLat | null {
  const [coord, setCoord] = useState<LngLat | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;

    (async () => {
      try {
        // Mirrors the heading hook: a cold start may mount this before permission
        // is granted, so await it here rather than firing a watch that fails.
        const existing = await Location.getForegroundPermissionsAsync();
        const granted = existing.granted
          ? true
          : (await Location.requestForegroundPermissionsAsync()).granted;
        if (cancelled || !granted) return;

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (loc) => {
            if (cancelled) return;
            setCoord([loc.coords.longitude, loc.coords.latitude]);
          },
        );
        if (cancelled) sub.remove();
        else subscription = sub;
      } catch {
        // No location / permission — leave coord null and show nothing.
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  return coord;
}
