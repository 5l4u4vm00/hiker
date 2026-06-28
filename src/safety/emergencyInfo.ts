import type { ParseKeys } from 'i18next';

/**
 * Offline emergency reference for hikers in Taiwan. Available without network.
 * Phone numbers are data; the `labelKey`/`noteKey` resolve to translated text
 * (see `safety.numbers.*` / `safety.tips.*` in the i18n resources) so the Safety
 * screen can render them in the active language.
 */
export interface EmergencyNumber {
  labelKey: ParseKeys;
  number: string;
  noteKey: ParseKeys;
}

export const TAIWAN_EMERGENCY_NUMBERS: EmergencyNumber[] = [
  {
    labelKey: 'safety.numbers.fireAmbulance.label',
    number: '119',
    noteKey: 'safety.numbers.fireAmbulance.note',
  },
  {
    labelKey: 'safety.numbers.police.label',
    number: '110',
    noteKey: 'safety.numbers.police.note',
  },
  {
    labelKey: 'safety.numbers.mobile.label',
    number: '112',
    noteKey: 'safety.numbers.mobile.note',
  },
  {
    labelKey: 'safety.numbers.nationalPark.label',
    number: '+886-7-6686151',
    noteKey: 'safety.numbers.nationalPark.note',
  },
];

/** Keys for the safety tips, resolved via `safety.tips.*` in the active language. */
export const SAFETY_TIP_KEYS: ParseKeys[] = [
  'safety.tips.shareRoute',
  'safety.tips.offlineMaps',
  'safety.tips.battery',
  'safety.tips.ifLost',
  'safety.tips.dial112',
];
