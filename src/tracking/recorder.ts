import * as Location from 'expo-location';

import {
  createTrack,
  deleteTrack,
  finishTrack,
  getActiveTrack,
  getTrackPoints,
  setTrackStatus,
  updateTrackWeather,
} from '@/db/tracks';
import type { TrackPoint } from '@/db/types';
import { useRecordingStore } from '@/state/recordingStore';
import { LOCATION_TASK } from '@/tracking/locationTask';
import { computeStats } from '@/tracking/stats';
import { fetchWeather } from '@/weather/openMeteo';

export interface PermissionResult {
  foreground: boolean;
  background: boolean;
}

const LOCATION_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 3000,
  distanceInterval: 5,
  deferredUpdatesInterval: 5000,
  pausesUpdatesAutomatically: false,
  activityType: Location.ActivityType.Fitness,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: 'Hiker is recording your hike',
    notificationBody: 'Tracking your location. Tap to return to the app.',
    notificationColor: '#208AEF',
  },
};

/**
 * Best-effort current location for centering the map when the screen opens.
 * Requests foreground permission (so the user dot can also show), then returns
 * the last known fix for an instant center, falling back to a fresh fix.
 * Returns null if permission is denied or no fix is available.
 */
export async function getInitialCoordinate(): Promise<[number, number] | null> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return null;
  const last = await Location.getLastKnownPositionAsync();
  const pos =
    last ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(
      () => null,
    ));
  if (!pos) return null;
  return [pos.coords.longitude, pos.coords.latitude];
}

export async function requestPermissions(): Promise<PermissionResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) {
    return { foreground: false, background: false };
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  return { foreground: true, background: bg.granted };
}

async function startUpdates(): Promise<void> {
  const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(
    () => false,
  );
  if (!alreadyRunning) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, LOCATION_OPTIONS);
  }
}

async function stopUpdates(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (running) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

/**
 * Starts a new hike recording. Returns the new track id, or null if location
 * permission was denied.
 */
/** Pushes the latest point's live values (altitude, speed, accuracy) to the store. */
function setLiveFromLastPoint(points: TrackPoint[]): void {
  const last = points[points.length - 1];
  if (!last) return;
  useRecordingStore.getState().setLive({
    altM: last.alt,
    speedMps: last.speed,
    accuracyM: last.accuracy,
    lat: last.lat,
    lon: last.lon,
    recordedAt: last.recordedAt,
  });
}

/**
 * Fetches a one-time weather snapshot for the hike start and stores it on the
 * track and in the live state. Fire-and-forget: best-effort, never blocks or
 * throws, and silently no-ops offline.
 */
async function captureStartWeather(trackId: string): Promise<void> {
  const coord = await getInitialCoordinate();
  if (!coord) return;
  const [lon, lat] = coord;
  const weather = await fetchWeather(lat, lon);
  if (!weather) return;
  // The hike may already be finished/discarded by the time this resolves; the
  // UPDATE simply matches no rows in that case, which is harmless.
  await updateTrackWeather(trackId, weather);
  if (useRecordingStore.getState().trackId === trackId) {
    useRecordingStore.getState().setLive({
      weatherTempC: weather.tempC,
      weatherCode: weather.code,
    });
  }
}

export async function startRecording(name: string): Promise<string | null> {
  const perms = await requestPermissions();
  if (!perms.foreground) return null;

  const track = await createTrack(name);
  useRecordingStore.getState().begin(track.id, track.startedAt);
  await startUpdates();
  void captureStartWeather(track.id);
  return track.id;
}

export async function pauseRecording(): Promise<void> {
  const { trackId } = useRecordingStore.getState();
  if (!trackId) return;
  await setTrackStatus(trackId, 'paused');
  useRecordingStore.getState().setStatus('paused');
}

export async function resumeRecording(): Promise<void> {
  const { trackId } = useRecordingStore.getState();
  if (!trackId) return;
  await setTrackStatus(trackId, 'recording');
  useRecordingStore.getState().setStatus('recording');
  await startUpdates();
}

/** Stops recording, persists final stats, and returns the completed track id. */
export async function stopRecording(): Promise<string | null> {
  const { trackId } = useRecordingStore.getState();
  if (!trackId) return null;

  await stopUpdates();
  const points = await getTrackPoints(trackId);
  const stats = computeStats(points);
  await finishTrack(trackId, stats);
  useRecordingStore.getState().reset();
  return trackId;
}

/** Stops recording and deletes the in-progress track without saving. */
export async function discardRecording(): Promise<void> {
  const { trackId } = useRecordingStore.getState();
  await stopUpdates();
  if (trackId) {
    await deleteTrack(trackId);
  }
  useRecordingStore.getState().reset();
}

/**
 * Restores recording state after an app restart. If a track was being recorded
 * (or paused) it is re-attached to the store and live stats recomputed.
 */
export async function restoreRecording(): Promise<void> {
  const active = await getActiveTrack();
  if (!active) return;
  const store = useRecordingStore.getState();
  store.begin(active.id, active.startedAt);
  store.setStatus(active.status === 'paused' ? 'paused' : 'recording');
  const points = await getTrackPoints(active.id);
  store.setStats(computeStats(points));
  setLiveFromLastPoint(points);
  if (active.weatherTempC != null && active.weatherCode != null) {
    store.setLive({ weatherTempC: active.weatherTempC, weatherCode: active.weatherCode });
  }
  if (active.status === 'recording') {
    await startUpdates();
  }
}

/** Recomputes live stats from persisted points; call periodically while recording. */
export async function refreshLiveStats(trackId: string): Promise<void> {
  const points = await getTrackPoints(trackId);
  useRecordingStore.getState().setStats(computeStats(points));
  setLiveFromLastPoint(points);
}
