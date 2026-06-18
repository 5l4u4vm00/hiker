/**
 * Domain types shared across the data layer and UI.
 *
 * All distances are in meters, durations in seconds, timestamps in epoch
 * milliseconds, and coordinates in WGS84 degrees.
 */

export type TrackStatus = 'recording' | 'paused' | 'completed';

export interface Track {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number | null;
  distanceM: number;
  ascentM: number;
  descentM: number;
  durationS: number;
  maxAlt: number | null;
  status: TrackStatus;
}

export interface TrackPoint {
  id: number;
  trackId: string;
  lat: number;
  lon: number;
  alt: number | null;
  accuracy: number | null;
  speed: number | null;
  recordedAt: number;
}

/** A single GPS sample before it is persisted (no row id yet). */
export type TrackPointInput = Omit<TrackPoint, 'id'>;

export type RouteSource = 'osm' | 'gpx' | 'manual';

export type RouteDifficulty = 'easy' | 'moderate' | 'hard' | 'expert';

export interface Route {
  id: string;
  name: string;
  region: string | null;
  difficulty: RouteDifficulty | null;
  distanceM: number;
  ascentM: number;
  source: RouteSource;
  /** GeoJSON LineString geometry, [lon, lat] coordinate order. */
  geometry: GeoJSON.LineString;
}

export type WaypointType = 'water' | 'campsite' | 'peak' | 'junction' | 'hut' | 'view' | 'other';

export interface Waypoint {
  id: string;
  routeId: string | null;
  trackId: string | null;
  lat: number;
  lon: number;
  name: string;
  type: WaypointType;
}

export interface JournalEntry {
  id: string;
  trackId: string;
  note: string;
  photoUris: string[];
  createdAt: number;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}
