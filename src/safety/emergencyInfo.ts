/** Offline emergency reference for hikers in Taiwan. Available without network. */
export interface EmergencyNumber {
  label: string;
  number: string;
  note: string;
}

export const TAIWAN_EMERGENCY_NUMBERS: EmergencyNumber[] = [
  {
    label: 'Fire / Ambulance / Mountain Rescue',
    number: '119',
    note: 'Primary number for medical and mountain rescue emergencies.',
  },
  {
    label: 'Police',
    number: '110',
    note: 'Police emergencies.',
  },
  {
    label: 'Mobile Emergency (no SIM / roaming)',
    number: '112',
    note: 'Works on any network, even without a SIM card or signal from your carrier.',
  },
  {
    label: 'National Park Rescue (NPR hotline)',
    number: '+886-7-6686151',
    note: 'Yushan National Park HQ. Check the relevant park for your specific area.',
  },
];

export const SAFETY_TIPS: string[] = [
  'Share your route and expected return time with someone before you set off.',
  'Download offline maps for your area in Settings before losing signal.',
  'Keep your phone in battery-saving mode and carry a power bank.',
  'If lost, stay put, keep warm, and make yourself visible to rescuers.',
  'Dial 112 if you have no signal from your own carrier — it uses any available network.',
];
