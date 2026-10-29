import { effect, Injectable, signal } from '@angular/core';
import { Lang, TextKey, TEXTS } from './texts';
import { parseDateKey } from './time';

const STORAGE_KEY = 'booking-desk:lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    // storage blocked: use the browser language
  }
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

@Injectable({ providedIn: 'root' })
export class I18n {
  readonly lang = signal<Lang>(detect());

  constructor() {
    effect(() => {
      const lang = this.lang();
      document.documentElement.lang = lang;
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        // not remembered, still switched
      }
    });
  }

  /** Reads `lang`, so templates update when the language changes. */
  t(key: TextKey, values?: Record<string, string | number>): string {
    return TEXTS[this.lang()][key].replace(/\{(\w+)\}/g, (match, name) =>
      values && name in values ? String(values[name]) : match,
    );
  }

  guests(n: number): string {
    return this.t(n === 1 ? 'guests.one' : 'guests.other', { n });
  }

  get locale(): string {
    return this.lang() === 'es' ? 'es-ES' : 'en-GB';
  }

  longDate(key: string): string {
    return new Intl.DateTimeFormat(this.locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(
      parseDateKey(key),
    );
  }
}
