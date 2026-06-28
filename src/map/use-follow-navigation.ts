import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Waypoint } from '@/db/types';
import { buildRouteIndex, projectOnRoute, projectWaypoints, type RouteIndex } from '@/tracking/navigation';
import { haversine } from '@/tracking/stats';

/** Distance (m) from the route at which the user is considered off-route. */
const OFF_ROUTE_ENTER_M = 50;
/** Distance (m) within which an off-route state clears (hysteresis band). */
const OFF_ROUTE_EXIT_M = 30;
/** Minimum off-route re-alert spacing (ms) while still off-route. */
const REALERT_INTERVAL_MS = 30000;
/** Exponential smoothing factor for the derived walking speed. */
const SPEED_SMOOTHING = 0.3;
/** Below this speed (m/s, ~1.1 km/h) ETA is not derivable. */
const MIN_SPEED_MPS = 0.3;
/** Along-route movement (m) needed before trusting the trend for direction. */
const DIRECTION_TREND_M = 20;

type Direction = 'forward' | 'reverse';

/** A route or track to follow, reduced to what guidance needs. */
export interface FollowGeometry {
  geometry: GeoJSON.LineString;
  waypoints: Waypoint[];
}

/** Live route-relative guidance derived from the user's position. */
export interface FollowNav {
  /** Fraction of the route completed toward the destination, 0..1. */
  progress: number;
  /** Remaining distance (m) to the destination along the route. */
  remainingM: number;
  /** Closest distance (m) from the user to the route line. */
  distanceToRouteM: number;
  /** True while the user is beyond the off-route threshold. */
  offRoute: boolean;
  /** The user's position snapped onto the route, as `[lon, lat]`. */
  snapped: [number, number];
  /** Auto-detected travel direction along the stored geometry. */
  direction: Direction;
  /** Next waypoint ahead in the travel direction, or null. */
  nextWaypoint: { name: string; distanceM: number; lat: number; lon: number } | null;
  /** Estimated time (s) to the destination, or null when speed is unknown. */
  etaSeconds: number | null;
}

/**
 * Derives live guidance for a followed route/track from the user's position.
 *
 * Travel direction is auto-detected: it is seeded toward the farther endpoint at
 * the first fix and then refined from the sign of the along-route trend. Off-route
 * detection uses hysteresis (enter > 50 m, clear < 30 m) so it does not flap, and
 * fires a warning haptic on entering — re-firing at most every 30 s while away.
 *
 * Pass `recordingPace` (the live recording stats) so ETA can use the actual moving
 * pace; otherwise speed is smoothed from successive fixes. The hook is independent
 * of recording — guidance works whether or not a hike is being recorded.
 */
export function useFollowNavigation(
  followPath: FollowGeometry | null,
  userCoord: [number, number] | null,
  recordingPace: { distanceM: number; movingTimeS: number } | null,
): FollowNav | null {
  const index = useMemo(
    () => (followPath ? buildRouteIndex(followPath.geometry.coordinates) : null),
    [followPath],
  );
  const waypointsAlong = useMemo(
    () => (index && followPath ? projectWaypoints(followPath.waypoints, index) : []),
    [index, followPath],
  );

  // The computed guidance is tagged with the index it was derived from, so a
  // stale result from a previous (or cleared) path is never returned.
  const [result, setResult] = useState<{ index: RouteIndex; nav: FollowNav } | null>(null);

  // Mutable tracking carried across location updates.
  const indexRef = useRef<RouteIndex | null>(null);
  const directionRef = useRef<Direction | null>(null);
  const alongHistory = useRef<number[]>([]);
  const offRouteRef = useRef(false);
  const lastAlertRef = useRef(0);
  const speedRef = useRef<number | null>(null);
  const lastFixRef = useRef<{ lon: number; lat: number; t: number } | null>(null);

  // Primitive inputs so the effect re-runs only on real changes (not on every
  // render's freshly-allocated coord array), which would otherwise loop on setState.
  const userLon = userCoord ? userCoord[0] : null;
  const userLat = userCoord ? userCoord[1] : null;
  const paceDistanceM = recordingPace ? recordingPace.distanceM : null;
  const paceMovingTimeS = recordingPace ? recordingPace.movingTimeS : null;

  useEffect(() => {
    if (!index || index.totalM === 0 || userLon == null || userLat == null) return;

    // Reset tracking when the followed path changes.
    if (indexRef.current !== index) {
      indexRef.current = index;
      directionRef.current = null;
      alongHistory.current = [];
      offRouteRef.current = false;
      lastAlertRef.current = 0;
      speedRef.current = null;
      lastFixRef.current = null;
    }

    const now = Date.now();
    const origin = { lat: userLat, lon: userLon };
    const proj = projectOnRoute(origin, index);
    if (!proj) return;

    // Direction: seed toward the farther endpoint, then refine from the trend.
    if (directionRef.current == null) {
      const start = index.coords[0];
      const end = index.coords[index.coords.length - 1];
      const dStart = haversine(origin, { lat: start[1], lon: start[0] });
      const dEnd = haversine(origin, { lat: end[1], lon: end[0] });
      directionRef.current = dEnd >= dStart ? 'forward' : 'reverse';
    }
    alongHistory.current.push(proj.alongM);
    if (alongHistory.current.length > 5) alongHistory.current.shift();
    if (alongHistory.current.length >= 3) {
      const delta = alongHistory.current[alongHistory.current.length - 1] - alongHistory.current[0];
      if (Math.abs(delta) > DIRECTION_TREND_M) {
        directionRef.current = delta > 0 ? 'forward' : 'reverse';
      }
    }
    const direction = directionRef.current;

    const progress = direction === 'forward' ? proj.alongM / index.totalM : 1 - proj.alongM / index.totalM;
    const remainingM = direction === 'forward' ? index.totalM - proj.alongM : proj.alongM;

    // Off-route hysteresis + haptic on transition / periodic re-alert.
    const wasOff = offRouteRef.current;
    let offRoute = wasOff;
    if (!offRoute && proj.distanceToRouteM > OFF_ROUTE_ENTER_M) offRoute = true;
    else if (offRoute && proj.distanceToRouteM < OFF_ROUTE_EXIT_M) offRoute = false;
    offRouteRef.current = offRoute;
    if (offRoute && (!wasOff || now - lastAlertRef.current > REALERT_INTERVAL_MS)) {
      lastAlertRef.current = now;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }

    // Speed: prefer the recording's moving pace, else smooth from fixes.
    let speed: number | null = null;
    if (paceDistanceM != null && paceMovingTimeS != null && paceMovingTimeS > 5 && paceDistanceM > 10) {
      speed = paceDistanceM / paceMovingTimeS;
    } else if (lastFixRef.current) {
      const dt = (now - lastFixRef.current.t) / 1000;
      if (dt > 0 && dt < 120) {
        const inst = haversine(origin, { lat: lastFixRef.current.lat, lon: lastFixRef.current.lon }) / dt;
        speedRef.current =
          speedRef.current == null ? inst : speedRef.current * (1 - SPEED_SMOOTHING) + inst * SPEED_SMOOTHING;
      }
      speed = speedRef.current;
    }
    lastFixRef.current = { lon: userLon, lat: userLat, t: now };
    const etaSeconds = speed != null && speed >= MIN_SPEED_MPS ? remainingM / speed : null;

    // Next waypoint ahead in the travel direction.
    let nextWaypoint: FollowNav['nextWaypoint'] = null;
    if (waypointsAlong.length > 0) {
      const ahead = waypointsAlong
        .filter((w) => (direction === 'forward' ? w.alongM > proj.alongM : w.alongM < proj.alongM))
        .sort((a, b) => (direction === 'forward' ? a.alongM - b.alongM : b.alongM - a.alongM));
      if (ahead.length > 0) {
        const wp = ahead[0];
        nextWaypoint = { name: wp.name, distanceM: Math.abs(wp.alongM - proj.alongM), lat: wp.lat, lon: wp.lon };
      }
    }

    setResult({
      index,
      nav: {
        progress: Math.max(0, Math.min(1, progress)),
        remainingM: Math.max(0, remainingM),
        distanceToRouteM: proj.distanceToRouteM,
        offRoute,
        snapped: proj.snapped,
        direction,
        nextWaypoint,
        etaSeconds,
      },
    });
  }, [index, waypointsAlong, userLon, userLat, paceDistanceM, paceMovingTimeS]);

  return result && result.index === index ? result.nav : null;
}
