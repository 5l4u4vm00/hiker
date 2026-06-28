/**
 * A generic pre-hike preparation checklist surfaced after a route is planned.
 * The list is static (the same for every route) and its toggle state is
 * ephemeral, so there is no table or per-route persistence. Labels are i18n keys
 * under `checklist.items.*`; sections map to `checklist.sections.*`.
 */

export type ChecklistSection = 'navigation' | 'supplies' | 'safety' | 'weather';

/** Keys under `checklist.items.*` in the locale files. */
export type ChecklistItemKey =
  | 'offlineMap'
  | 'routeShared'
  | 'compass'
  | 'water'
  | 'food'
  | 'powerBank'
  | 'firstAid'
  | 'headlamp'
  | 'whistle'
  | 'rainGear'
  | 'layers'
  | 'forecast';

export interface ChecklistItem {
  id: string;
  labelKey: ChecklistItemKey;
  section: ChecklistSection;
}

export const PREP_CHECKLIST: ChecklistItem[] = [
  { id: 'offline-map', labelKey: 'offlineMap', section: 'navigation' },
  { id: 'route-shared', labelKey: 'routeShared', section: 'navigation' },
  { id: 'compass', labelKey: 'compass', section: 'navigation' },
  { id: 'water', labelKey: 'water', section: 'supplies' },
  { id: 'food', labelKey: 'food', section: 'supplies' },
  { id: 'power-bank', labelKey: 'powerBank', section: 'supplies' },
  { id: 'first-aid', labelKey: 'firstAid', section: 'safety' },
  { id: 'headlamp', labelKey: 'headlamp', section: 'safety' },
  { id: 'whistle', labelKey: 'whistle', section: 'safety' },
  { id: 'rain-gear', labelKey: 'rainGear', section: 'weather' },
  { id: 'layers', labelKey: 'layers', section: 'weather' },
  { id: 'forecast', labelKey: 'forecast', section: 'weather' },
];

export const CHECKLIST_SECTIONS: ChecklistSection[] = [
  'navigation',
  'supplies',
  'safety',
  'weather',
];
