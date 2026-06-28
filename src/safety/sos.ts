import * as Location from 'expo-location';
import { Linking, Platform, Share } from 'react-native';

import type { EmergencyContact } from '@/db/types';
import i18n from '@/i18n';

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
  const altText =
    coords.alt != null ? `\n${i18n.t('sos.altitude', { value: Math.round(coords.alt) })}` : '';
  const accText =
    coords.accuracy != null
      ? `\n${i18n.t('sos.accuracy', { value: Math.round(coords.accuracy) })}`
      : '';
  return (
    `${i18n.t('sos.emergencyHeader')}\n` +
    `${i18n.t('sos.latLon', { lat, lon })}${altText}${accText}\n` +
    `${i18n.t('sos.map', { url: mapsUrl })}\n` +
    `${i18n.t('sos.sentFrom', { time: new Date().toLocaleString() })}`
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
