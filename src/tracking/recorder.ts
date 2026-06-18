import * as Location from 'expo-location';

import {
  createTrack,
  deleteTrack,
  finishTrack,
  getActiveTrack,
  getTrackPoints,
  setTrackStatus,
} from '@/db/tracks';
import { useRecordingStore } from '@/state/recordingStore';
import { LOCATION_TASK } from '@/tracking/locationTask';
import { computeStats } from '@/tracking/stats';

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
export async function startRecording(name: string): Promise<string | null> {
  const perms = await requestPermissions();
  if (!perms.foreground) return null;

  const track = await createTrack(name);
  useRecordingStore.getState().begin(track.id, track.startedAt);
  await startUpdates();
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
  if (active.status === 'recording') {
    await startUpdates();
  }
}

/** Recomputes live stats from persisted points; call periodically while recording. */
export async function refreshLiveStats(trackId: string): Promise<void> {
  const points = await getTrackPoints(trackId);
  useRecordingStore.getState().setStats(computeStats(points));
}
