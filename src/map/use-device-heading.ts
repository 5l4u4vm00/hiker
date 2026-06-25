import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

/** Ignore sub-degree jitter from the magnetometer to avoid needless re-renders. */
const MIN_DELTA_DEG = 2;

/**
 * Subscribes to the device compass and returns the heading in degrees clockwise
 * from north (0 = north, 90 = east), or `null` until a reading is available.
 *
 * Unlike GPS course-over-ground (`coords.heading`), this reflects the direction
 * the device is physically pointing even while stationary — the Google-Maps
 * "blue cone" behavior. `trueHeading` needs location permission; we fall back to
 * `magHeading` so a reading still appears without prompting.
 */
export function useDeviceHeading(enabled = true): number | null {
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;
    let last = -1;

    (async () => {
      try {
        // Heading updates need foreground location permission. On a cold start
        // the map may mount this hook before permission is granted; await it
        // here (rather than firing watchHeadingAsync and silently failing) so
        // the arrow appears as soon as access is allowed, not only later once
        // some other screen has prompted.
        const existing = await Location.getForegroundPermissionsAsync();
        const granted = existing.granted
          ? true
          : (await Location.requestForegroundPermissionsAsync()).granted;
        if (cancelled || !granted) return;

        const sub = await Location.watchHeadingAsync((reading) => {
          if (cancelled) return;
          const deg = reading.trueHeading >= 0 ? reading.trueHeading : reading.magHeading;
          if (deg < 0) return;
          if (last < 0 || Math.abs(deg - last) >= MIN_DELTA_DEG) {
            last = deg;
            setHeading(deg);
          }
        });
        if (cancelled) sub.remove();
        else subscription = sub;
      } catch {
        // No compass / permission — leave heading null and just show the dot.
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  return heading;
}
