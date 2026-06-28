import 'i18next';

import type en from './locales/en.json';

// Make the `t` function and keys type-safe against the English resource shape.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
