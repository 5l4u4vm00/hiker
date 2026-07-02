import * as Speech from 'expo-speech';

import i18n from '@/i18n';
import { useVoiceStore } from '@/state/voiceStore';

/** Maps the active app locale to a BCP-47 tag the TTS engine understands. */
function speechLanguage(): string {
  return i18n.language === 'zh-Hant' ? 'zh-TW' : 'en-US';
}

/**
 * Speaks a guidance phrase, unless voice guidance is disabled. Any in-progress
 * utterance is stopped first so the newest, most-relevant announcement is heard
 * immediately rather than queued behind stale ones.
 */
export function speak(text: string): void {
  if (!useVoiceStore.getState().enabled) return;
  Speech.stop();
  Speech.speak(text, { language: speechLanguage() });
}

/** Cancels any ongoing speech (e.g. when following ends or voice is muted). */
export function stopSpeaking(): void {
  Speech.stop();
}
