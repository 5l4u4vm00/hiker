import { useEffect, useRef } from 'react';

import i18n from '@/i18n';
import type { FollowNav } from '@/map/use-follow-navigation';
import { formatDistance } from '@/tracking/stats';
import { speak, stopSpeaking } from '@/tracking/voice';

/** Remaining-distance thresholds (m) at which an upcoming waypoint is announced. */
const WAYPOINT_THRESHOLDS = [1000, 500, 100];
/** Within this distance (m) a waypoint counts as reached. */
const WAYPOINT_ARRIVE_M = 25;
/** Within this remaining distance (m) the destination counts as reached. */
const DESTINATION_ARRIVE_M = 30;

/**
 * Speaks event-based guidance for a followed route/track: off-route transitions,
 * upcoming/arrived waypoints, and arrival at the destination. Announcements are
 * de-duplicated and reset per follow session. Spoken text and distances follow
 * the active app language; muting (via the voice store) silences it — see
 * `@/tracking/voice`.
 */
export function useVoiceGuidance(name: string | undefined, nav: FollowNav | null): void {
  // Previous off-route state (null until the first fix of a session).
  const wasOffRoute = useRef<boolean | null>(null);
  // The waypoint name whose thresholds `crossed` currently tracks.
  const wpName = useRef<string | null>(null);
  // Thresholds already announced for the current next waypoint.
  const crossed = useRef<Set<number>>(new Set());
  // Waypoint names for which arrival has been announced.
  const arrived = useRef<Set<string>>(new Set());
  // Whether destination arrival has been announced this session.
  const destAnnounced = useRef(false);
  // Whether a follow session is currently active (nav non-null).
  const sessionActive = useRef(false);

  useEffect(() => {
    if (!nav) {
      // Following ended: cut off any utterance and reset for the next session.
      if (sessionActive.current) {
        stopSpeaking();
        sessionActive.current = false;
        wasOffRoute.current = null;
        wpName.current = null;
        crossed.current = new Set();
        arrived.current = new Set();
        destAnnounced.current = false;
      }
      return;
    }
    sessionActive.current = true;

    // Off-route transitions (mirrors the haptic in use-follow-navigation).
    if (wasOffRoute.current !== null && nav.offRoute !== wasOffRoute.current) {
      speak(nav.offRoute ? i18n.t('voice.offRoute') : i18n.t('voice.backOnRoute'));
    }
    wasOffRoute.current = nav.offRoute;

    const wp = nav.nextWaypoint;
    if (wp) {
      // Reset threshold tracking when the next waypoint changes.
      if (wpName.current !== wp.name) {
        wpName.current = wp.name;
        crossed.current = new Set();
      }
      if (wp.distanceM <= WAYPOINT_ARRIVE_M) {
        if (!arrived.current.has(wp.name)) {
          arrived.current.add(wp.name);
          speak(i18n.t('voice.arrivedWaypoint', { name: wp.name }));
        }
      } else {
        // Announce the nearest not-yet-passed threshold; mark all passed ones
        // so an early fix already inside a threshold does not burst-announce.
        const pending = WAYPOINT_THRESHOLDS.filter(
          (th) => wp.distanceM <= th && !crossed.current.has(th),
        );
        if (pending.length > 0) {
          const threshold = Math.min(...pending);
          pending.forEach((th) => crossed.current.add(th));
          speak(i18n.t('voice.approachingWaypoint', { distance: formatDistance(threshold), name: wp.name }));
        }
      }
    } else if (
      !destAnnounced.current &&
      (nav.remainingM < DESTINATION_ARRIVE_M || nav.progress > 0.98)
    ) {
      destAnnounced.current = true;
      speak(i18n.t('voice.arrivedDestination'));
    }
  }, [name, nav]);
}
