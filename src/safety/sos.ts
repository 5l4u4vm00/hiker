import * as Location from 'expo-location';
import { Linking, Platform, Share } from 'react-native';

import type { EmergencyContact } from '@/db/types';

export interface Coordinates {
  lat: number;
  lon: number;
  alt: number | null;
  accuracy: number | null;
}

/** Gets a single high-accuracy fix for an SOS message, or null if unavailable. */
export async function getCurrentCoordinates(): Promise<Coordinates | null> {
  const perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted) {
    const req = await Location.requestForegroundPermissionsAsync();
    if (!req.granted) return null;
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
  });
  return {
    lat: pos.coords.latitude,
    lon: pos.coords.longitude,
    alt: pos.coords.altitude,
    accuracy: pos.coords.accuracy,
  };
}

/** Builds a human-readable SOS message including a maps link to the location. */
export function buildSosMessage(coords: Coordinates): string {
  const lat = coords.lat.toFixed(6);
  const lon = coords.lon.toFixed(6);
  const mapsUrl = `https://maps.google.com/?q=${lat},${lon}`;
  const altText = coords.alt != null ? `\nAltitude: ${Math.round(coords.alt)} m` : '';
  const accText =
    coords.accuracy != null ? `\nAccuracy: ±${Math.round(coords.accuracy)} m` : '';
  return (
    `EMERGENCY — I need help. My current location:\n` +
    `Lat: ${lat}, Lon: ${lon}${altText}${accText}\n` +
    `Map: ${mapsUrl}\n` +
    `Sent from Hiker at ${new Date().toLocaleString()}`
  );
}

/** Opens the SMS composer pre-filled with the SOS message and recipients. */
export async function sendSosSms(
  message: string,
  contacts: EmergencyContact[],
): Promise<boolean> {
  const recipients = contacts.map((c) => c.phone).join(Platform.OS === 'ios' ? ',' : ';');
  const separator = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${recipients}${separator}body=${encodeURIComponent(message)}`;
  const supported = await Linking.canOpenURL(url);
  if (!supported) return false;
  await Linking.openURL(url);
  return true;
}

/** Opens the native share sheet so the location can be sent via any app. */
export async function shareLocation(message: string): Promise<void> {
  await Share.share({ message });
}

/** Starts a phone call to an emergency number. */
export async function callNumber(number: string): Promise<void> {
  const url = `tel:${number.replace(/[^+\d]/g, '')}`;
  if (await Linking.canOpenURL(url)) {
    await Linking.openURL(url);
  }
}
