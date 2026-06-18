import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { addTrackPoints, getActiveTrack } from '@/db/tracks';

/**
 * Background location task name. Defining the task at module scope ensures it is
 * registered as soon as this module is imported (done once from the root layout).
 */
export const LOCATION_TASK = 'hiker-location-tracking';

interface LocationTaskData {
  locations?: Location.LocationObject[];
}

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[locationTask] error', error.message);
    return;
  }
  const { locations } = (data ?? {}) as LocationTaskData;
  if (!locations || locations.length === 0) return;

  // The task runs in its own context, so the active track is read from the DB.
  const track = await getActiveTrack();
  if (!track || track.status !== 'recording') return;

  await addTrackPoints(
    locations.map((loc) => ({
      trackId: track.id,
      lat: loc.coords.latitude,
      lon: loc.coords.longitude,
      alt: loc.coords.altitude,
      accuracy: loc.coords.accuracy,
      speed: loc.coords.speed,
      recordedAt: loc.timestamp,
    })),
  );
});
